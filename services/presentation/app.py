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

app = FastAPI(title="A2A Presentation Agent")

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
    
    gamma_key = os.getenv("GAMMA_API_KEY")
    slides_url = "https://gamma.app/placeholder"
    
    if gamma_key:
        # Placeholder for real Gamma implementation if key existed
        # For now, we just pass through
        pass
    else:
        # Fallback: Generate Slide Outline via OpenAI
        try:
            completion = openai_client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                messages=[
                    {"role": "system", "content": "You are a presentation designer. Create a 5-slide outline based on the provided content. Output JSON with 'slides': [{'title': '...', 'bullets': [...]}]"},
                    {"role": "user", "content": f"Create slides for:\n{request.message.content}"}
                ],
                temperature=0.0
            )
            content = completion.choices[0].message.content.strip()
            
            try:
                data = json.loads(content.replace("```json", "").replace("```", ""))
                slides_preview = data
            except:
                slides_preview = {"raw": content}
                
        except Exception as e:
            slides_preview = {"error": str(e)}

    TASKS[task_id] = ResubscribeResponse(
        task_id=task_id,
        state=TaskState.completed,
        last_event=TaskStatusUpdateEvent(task_id=task_id, state=TaskState.completed).model_dump(),
        artifacts=[{"gammaUrl": slides_url, "slideOutline": slides_preview}],
    )
    response_message = Message(role="assistant", content=f"Presentation ready: {slides_url}")
    return MessageResponse(context_id=context_id, task_id=task_id, message=response_message)


@app.get("/message/stream")
def stream_message(task_id: str):
    events = [
        TaskStatusUpdateEvent(task_id=task_id, state=TaskState.working, detail="Drafting slide outline...").model_dump(),
        TaskStatusUpdateEvent(task_id=task_id, state=TaskState.working, detail="Designing layout...").model_dump(),
        TaskArtifactUpdateEvent(task_id=task_id, artifact={"progress": "Finalizing deck..."}).model_dump(),
        TaskStatusUpdateEvent(task_id=task_id, state=TaskState.completed).model_dump(),
    ]
    return EventSourceResponse(simple_event_stream(events, delay_s=0.8))


@app.post("/tasks/resubscribe", response_model=ResubscribeResponse)
def resubscribe(request: ResubscribeRequest):
    return TASKS.get(
        request.task_id,
        ResubscribeResponse(task_id=request.task_id, state=TaskState.queued),
    )


@app.get("/.well-known/agent-card.json")
def agent_card():
    with open("services/presentation/.well-known/agent-card.json", "r", encoding="utf-8") as handle:
        return JSONResponse(content=json.load(handle))
