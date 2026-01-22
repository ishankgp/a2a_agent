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

app = FastAPI(title="A2A Review Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8001",
        "http://localhost:8002", 
        "http://localhost:8003",
        "http://localhost:8004",
        "http://127.0.0.1:8001",
        "http://127.0.0.1:8002",
        "http://127.0.0.1:8003",
        "http://127.0.0.1:8004",
    ],
    allow_credentials=True,
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
    
    # Real OpenAI Review
    try:
        completion = openai_client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": "You are a medical content reviewer. Review the provided research summary for patient-friendliness, clarity, and safety. \n\nOutput a valid JSON object with:\n- revisedSummary: A clearer version of the summary.\n- warnings: List of potential safety issues or missing citations.\n- patientFriendlyScore: A score from 1-5.\n\nDo not use markdown formatting for the JSON."},
                {"role": "user", "content": f"Review this content:\n{request.message.content}"}
            ],
            temperature=0.0
        )
        content = completion.choices[0].message.content.strip()
        
        # Best effort parsing
        try:
            data = json.loads(content)
            revised_text = data.get("revisedSummary", "No revision provided.")
            artifacts = [data]
        except json.JSONDecodeError:
            revised_text = content
            artifacts = [{"raw": content}]

    except Exception as e:
        print(f"Error calling OpenAI: {e}")
        revised_text = "Review failed."
        artifacts = [{"error": str(e)}]

    TASKS[task_id] = ResubscribeResponse(
        task_id=task_id,
        state=TaskState.completed,
        last_event=TaskStatusUpdateEvent(task_id=task_id, state=TaskState.completed).model_dump(),
        artifacts=artifacts,
    )
    response_message = Message(role="assistant", content=content)
    return MessageResponse(context_id=context_id, task_id=task_id, message=response_message)


@app.get("/message/stream")
def stream_message(task_id: str):
    events = [
        TaskStatusUpdateEvent(task_id=task_id, state=TaskState.working, detail="Analyzing tone and clarity...").model_dump(),
        TaskArtifactUpdateEvent(task_id=task_id, artifact={"note": "Checking compliance..."}).model_dump(),
        TaskStatusUpdateEvent(task_id=task_id, state=TaskState.completed).model_dump(),
    ]
    return EventSourceResponse(simple_event_stream(events, delay_s=0.6))


@app.post("/tasks/resubscribe", response_model=ResubscribeResponse)
def resubscribe(request: ResubscribeRequest):
    return TASKS.get(
        request.task_id,
        ResubscribeResponse(task_id=request.task_id, state=TaskState.queued),
    )


@app.get("/.well-known/agent-card.json")
def agent_card():
    with open("services/review/.well-known/agent-card.json", "r", encoding="utf-8") as handle:
        return JSONResponse(content=json.load(handle))
