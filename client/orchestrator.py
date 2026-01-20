from __future__ import annotations

import os
import uuid

import httpx

TRIAGE_URL = os.getenv("TRIAGE_URL", "http://localhost:8001")
RESEARCH_URL = os.getenv("RESEARCH_URL", "http://localhost:8002")
REVIEW_URL = os.getenv("REVIEW_URL", "http://localhost:8003")
PRESENTATION_URL = os.getenv("PRESENTATION_URL", "http://localhost:8004")


def post_message(url: str, content: str, context_id: str, task_id: str | None = None) -> dict:
    payload = {
        "context_id": context_id,
        "task_id": task_id,
        "message": {"role": "user", "content": content},
    }
    response = httpx.post(f"{url}/message", json=payload, timeout=20)
    response.raise_for_status()
    return response.json()


def run_pipeline(prompt: str) -> dict:
    context_id = str(uuid.uuid4())
    triage = post_message(TRIAGE_URL, prompt, context_id)
    route = "medical_research" if "research" in prompt.lower() else "presentation"
    if route == "medical_research":
        research = post_message(RESEARCH_URL, prompt, context_id)
        review = post_message(REVIEW_URL, research["message"]["content"], context_id)
        presentation = post_message(PRESENTATION_URL, review["message"]["content"], context_id)
        return {
            "triage": triage,
            "research": research,
            "review": review,
            "presentation": presentation,
        }
    presentation = post_message(PRESENTATION_URL, prompt, context_id)
    return {"triage": triage, "presentation": presentation}


if __name__ == "__main__":
    result = run_pipeline("Create a patient-friendly presentation on diabetes management.")
    print(result)
