from __future__ import annotations

import json
import time
from typing import Iterable, Iterator


def format_sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def simple_event_stream(events: Iterable[dict], delay_s: float = 0.5) -> Iterator[str]:
    for event in events:
        time.sleep(delay_s)
        yield format_sse(event)
