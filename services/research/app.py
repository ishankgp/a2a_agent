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

app = FastAPI(title="A2A Medical Research Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

TASKS: Dict[str, ResubscribeResponse] = {}


import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

@app.post("/message", response_model=MessageResponse)
def message(request: MessageRequest) -> MessageResponse:
    task_id = request.task_id or str(uuid.uuid4())
    context_id = request.context_id or str(uuid.uuid4())
    
    # Real Gemini Research
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"""
        You are a medical research assistant. Research the following query and provide a structured summary.
        Query: {request.message.content}
        
        Output valid JSON with the following keys:
        - summary: A detailed medical summary (approx 100 words).
        - keyPoints: A list of 3-5 key takeaways.
        - riskFactors: A list of risk factors.
        - audienceTone: The detected tone (e.g., 'clinical', 'patient-friendly').
        
        Do not use markdown formatting for the JSON. Just raw JSON.
        """
        response = model.generate_content(prompt)
        content = response.text.replace("```json", "").replace("```", "").strip()
        
        # Best effort parsing, though we pass string to orchestrator usually
        try:
            data = json.loads(content)
            summary_text = data.get("summary", "No summary provided.")
            artifacts = [data]
        except json.JSONDecodeError:
            summary_text = content
            artifacts = [{"raw": content}]

    except Exception as e:
        import traceback
        # Log deep details
        with open("research_debug.log", "w") as f:
            f.write(traceback.format_exc())
            
        print(f"Error calling Gemini: {e}")
        
        # FALLBACK: Return mock data so demo continues
        summary_text = f"**[MOCK] Research Fallback**\n\nThe AI research service is unavailable (Error: {str(e)}). Displaying a placeholder research summary regarding '{request.message.content}'.\n\nRecent advancements include CAR-T cell therapy, mRNA vaccines, and CRISPR gene editing."
        
        artifacts = [{
            "summary": summary_text,
            "keyPoints": ["Mock Point 1: AI Service Offline", "Mock Point 2: Check API Key", "Mock Point 3: Demo Mode Active"],
            "riskFactors": ["Invalid API Key", "Network Error"],
            "audienceTone": "system-alert"
        }]
        
        # FIX: Define content for the return statement below
        content = summary_text

    TASKS[task_id] = ResubscribeResponse(
        task_id=task_id,
        state=TaskState.completed,
        last_event=TaskStatusUpdateEvent(task_id=task_id, state=TaskState.completed).model_dump(),
        artifacts=artifacts,
    )
    
    # Orchestrator expects string content in message
    response_message = Message(role="assistant", content=content)
    return MessageResponse(context_id=context_id, task_id=task_id, message=response_message)


@app.get("/message/stream")
def stream_message(task_id: str):
    events = [
        TaskStatusUpdateEvent(task_id=task_id, state=TaskState.working, detail="Consulting medical database...").model_dump(),
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
    with open("services/research/.well-known/agent-card.json", "r", encoding="utf-8") as handle:
        return JSONResponse(content=json.load(handle))
