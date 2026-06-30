"""B5 — WebSocket connection manager.

One ConnectionManager instance shared across the app.
Clients subscribe to a session_id; the pipeline runner broadcasts events
from its background thread via broadcast_from_thread().
"""
from __future__ import annotations

import asyncio
import json
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(session_id, set()).add(ws)

    def disconnect(self, session_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(session_id, set())
        conns.discard(ws)
        if not conns:
            self._connections.pop(session_id, None)

    async def broadcast(self, session_id: str, event: dict) -> None:
        conns = set(self._connections.get(session_id, set()))
        if not conns:
            return
        payload = json.dumps(event, ensure_ascii=False)
        dead: set[WebSocket] = set()
        for ws in conns:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(session_id, ws)

    def broadcast_from_thread(self, session_id: str, event: dict) -> None:
        """Safe to call from a background thread (e.g. CrewAI ThreadPoolExecutor)."""
        if self._loop is None:
            return
        asyncio.run_coroutine_threadsafe(
            self.broadcast(session_id, event),
            self._loop,
        )


manager = ConnectionManager()
