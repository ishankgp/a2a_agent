from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TaskState(str, Enum):
    queued = "queued"
    working = "working"
    input_required = "input-required"
    completed = "completed"
    failed = "failed"


class Message(BaseModel):
    role: str
    content: str


class TaskStatusUpdateEvent(BaseModel):
    event: str = Field(default="task-status", const=True)
    task_id: str
    state: TaskState
    detail: Optional[str] = None


class TaskArtifactUpdateEvent(BaseModel):
    event: str = Field(default="task-artifact", const=True)
    task_id: str
    artifact: Dict[str, Any]


class MessageRequest(BaseModel):
    context_id: Optional[str] = None
    task_id: Optional[str] = None
    message: Message
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MessageResponse(BaseModel):
    context_id: str
    task_id: str
    message: Message
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ResubscribeRequest(BaseModel):
    task_id: str


class ResubscribeResponse(BaseModel):
    task_id: str
    state: TaskState
    last_event: Optional[Dict[str, Any]] = None
    artifacts: List[Dict[str, Any]] = Field(default_factory=list)
