# Implementation Plan

## Goal
Deliver a runnable A2A demo that follows the README vision: triage → research → review → presentation with streaming updates and agent cards.

## Phase 1: Service Scaffolding (Now)
- Create a shared schema module for messages and task events.
- Scaffold FastAPI services for triage, research, review, and presentation.
- Implement required endpoints:
  - `POST /message`
  - `GET /message/stream` (SSE)
  - `POST /tasks/resubscribe`
  - `GET /.well-known/agent-card.json`
- Provide example responses and minimal in-memory task tracking.

## Phase 2: Orchestrator
- Build a client orchestrator that calls triage and chains agents.
- Preserve `context_id` and `task_id` between calls.

## Phase 3: API Integrations
- Wire OpenAI (triage + review) SDK calls.
- Wire Gemini research SDK calls with streaming.
- Wire Gamma API generation and polling.
- Add configuration via environment variables and secrets.

## Phase 4: UI Demo
- Implement Task Monitor, pipeline visualization, and streaming output.
- Add animations (handoff, status, artifacts) via Framer Motion.
- Embed Gamma presentation or link card.

## Phase 5: QA + Demo Assets
- Add local run steps and environment setup.
- Provide demo script and recording.
- Add fallback logic for streaming failures.
