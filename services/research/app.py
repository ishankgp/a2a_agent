from __future__ import annotations
import asyncio
import time
import uuid
import json
import os
from typing import Dict, List

from fastapi import FastAPI
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

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI(title="A2A Medical Research Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# State storage for streaming updates
# mapping: task_id -> {"state": TaskState, "detail": str, "timestamp": float}
TASK_UPDATES: Dict[str, dict] = {}

# State storage for resubscribe endpoint
TASKS: Dict[str, ResubscribeResponse] = {}

@app.post("/message", response_model=MessageResponse)
def message(request: MessageRequest) -> MessageResponse:
    print(f"Research Agent received message: {request.message.content}")
    task_id = request.task_id or str(uuid.uuid4())
    context_id = request.context_id or str(uuid.uuid4())
    
    # helper to update state
    def update_state(state: TaskState, detail: str):
        TASK_UPDATES[task_id] = {
            "state": state,
            "detail": detail,
            "timestamp": time.time()
        }
    
    update_state(TaskState.working, "Initializing medical research agent...")
    time.sleep(1) # Visual pacing
    
    # Real OpenAI Research
    try:
        update_state(TaskState.working, "Consulting OpenAI GPT-4o...")
        
        system_prompt = """
        You are a medical research assistant. Research the following query and provide a structured summary.
        Output valid JSON with the following keys:
        - summary: A detailed medical summary (approx 100 words).
        - keyPoints: A list of 3-5 key takeaways.
        - riskFactors: A list of risk factors.
        - audienceTone: The detected tone (e.g., 'clinical', 'patient-friendly').
        """
        
        response = openai_client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message.content}
            ],
            temperature=0.3
        )
        content = response.choices[0].message.content
        
        update_state(TaskState.working, "Parsing research findings...")
        
        data = json.loads(content)
        summary_text = data.get("summary", "No summary provided.")
        artifacts = [data]



    except Exception as e:
        import traceback
        with open("research_debug.log", "w") as f:
            f.write(traceback.format_exc())
            
        print(f"Error calling OpenAI: {e}")
        
        update_state(TaskState.failed, f"Error: {str(e)}")
        
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

    update_state(TaskState.completed, "Research complete.")

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
async def stream_message(task_id: str):
    async def event_generator():
        last_timestamp = 0
        # Poll for 60 seconds max
        for _ in range(120): 
            if task_id in TASK_UPDATES:
                update = TASK_UPDATES[task_id]
                if update["timestamp"] > last_timestamp:
                    last_timestamp = update["timestamp"]
                    yield TaskStatusUpdateEvent(
                        task_id=task_id, 
                        state=update["state"], 
                        detail=update["detail"]
                    ).model_dump_json()
                    
                    if update["state"] in [TaskState.completed, TaskState.failed]:
                        break
            
            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


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
