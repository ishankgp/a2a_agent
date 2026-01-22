from __future__ import annotations

import uuid
from typing import Dict

from fastapi import FastAPI
import json

from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from services.common.schemas import (
    Message,
    MessageRequest,
    MessageResponse,
    ResubscribeRequest,
    ResubscribeResponse,
    TaskArtifactUpdateEvent,
    TaskState,
    TaskStatusUpdateEvent,
)
from services.common.sse import simple_event_stream

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="A2A Triage Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

TASKS: Dict[str, ResubscribeResponse] = {}


import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.post("/message", response_model=MessageResponse)
def message(request: MessageRequest) -> MessageResponse:
    task_id = request.task_id or str(uuid.uuid4())
    context_id = request.context_id or str(uuid.uuid4())
    
    # Real OpenAI Routing
    try:
        completion = openai_client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": "You are a triage agent for a healthcare research system. Your job is to route user requests.\n\nRoutes:\n- 'medical_research': Use this for ANY request about a medical topic, disease, treatment, or health condition. This includes requests like 'create a presentation about X' or 'explain Y' - these STILL need research first.\n- 'presentation': Use this ONLY if the user provides COMPLETE, ready-to-use content and just wants it formatted as slides. This is rare.\n\nWhen in doubt, choose 'medical_research'.\n\nOutput ONLY the route name: 'medical_research' or 'presentation'."},
                {"role": "user", "content": request.message.content}
            ],
            temperature=0.0
        )
        route = completion.choices[0].message.content.strip()
        if route not in ["medical_research", "presentation"]:
            route = "medical_research" # Default fallback
            
    except Exception as e:
        print(f"Error calling OpenAI: {e}")
        route = "medical_research"

    TASKS[task_id] = ResubscribeResponse(
        task_id=task_id,
        state=TaskState.completed,
        last_event=TaskStatusUpdateEvent(task_id=task_id, state=TaskState.completed).model_dump(),
        artifacts=[{"route": route}],
    )
    response_message = Message(role="assistant", content=f"Routed to {route} agent")
    return MessageResponse(context_id=context_id, task_id=task_id, message=response_message)


@app.get("/message/stream")
def stream_message(task_id: str):
    events = [
        TaskStatusUpdateEvent(task_id=task_id, state=TaskState.working, detail="Analyzing intent...").model_dump(),
        TaskStatusUpdateEvent(task_id=task_id, state=TaskState.working, detail="Routing request...").model_dump(),
        TaskStatusUpdateEvent(task_id=task_id, state=TaskState.completed).model_dump(),
    ]
    return EventSourceResponse(simple_event_stream(events, delay_s=0.5))


@app.post("/tasks/resubscribe", response_model=ResubscribeResponse)
def resubscribe(request: ResubscribeRequest):
    return TASKS.get(
        request.task_id,
        ResubscribeResponse(task_id=request.task_id, state=TaskState.queued),
    )


@app.get("/.well-known/agent-card.json")
def agent_card():
    with open("services/triage/.well-known/agent-card.json", "r", encoding="utf-8") as handle:
        return JSONResponse(content=json.load(handle))
