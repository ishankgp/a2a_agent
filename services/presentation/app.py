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

app = FastAPI(title="A2A Presentation Agent")

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
import time
import httpx
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.post("/message", response_model=MessageResponse)
def message(request: MessageRequest) -> MessageResponse:
    task_id = request.task_id or str(uuid.uuid4())
    context_id = request.context_id or str(uuid.uuid4())
    
    gamma_key = os.getenv("GAMMA_API_KEY")
    slides_url = "https://gamma.app/error"
    artifacts = []
    
    if gamma_key:
        try:
            # 1. Start Generation
            headers = {"X-API-KEY": gamma_key, "Content-Type": "application/json"}
            payload = {
                "inputText": request.message.content,
                "textMode": "generate",
                "format": "presentation",
                "numCards": 7
            }
            
            with httpx.Client(timeout=30.0) as client:
                resp = client.post("https://public-api.gamma.app/v1.0/generations", json=payload, headers=headers)
                resp.raise_for_status()
                job_id = resp.json()["id"]
                
                # 2. Poll for Completion
                status = "queued"
                while status in ["queued", "processing"]:
                    time.sleep(2.0)
                    job_resp = client.get(f"https://public-api.gamma.app/v1.0/generations/{job_id}", headers=headers)
                    if job_resp.status_code == 200:
                        job_data = job_resp.json()
                        status = job_data["status"]
                        if status == "completed":
                            slides_url = job_data["url"]
                            artifacts = [{"gammaUrl": slides_url}]
                            break
                        elif status == "failed":
                            slides_url = "https://gamma.app/failed"
                            artifacts = [{"error": "Gamma generation failed"}]
                            break
                    else:
                        break

        except Exception as e:
            print(f"Gamma Error: {e}")
            slides_url = "https://gamma.app/error"
            artifacts = [{"error": str(e)}]

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
            except json.JSONDecodeError:
                slides_preview = {"raw": content}
                
            slides_url = "https://gamma.app/placeholder-outline"
            artifacts = [{"gammaUrl": slides_url, "slideOutline": slides_preview}]
                
        except Exception as e:
            slides_preview = {"error": str(e)}
            artifacts = [{"error": str(e)}]

    TASKS[task_id] = ResubscribeResponse(
        task_id=task_id,
        state=TaskState.completed,
        last_event=TaskStatusUpdateEvent(task_id=task_id, state=TaskState.completed).model_dump(),
        artifacts=artifacts,
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
