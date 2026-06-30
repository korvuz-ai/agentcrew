"""B5 — WebSocket endpoint for session event streaming."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import manager

router = APIRouter()


@router.websocket("/ws/sessions/{session_id}")
async def ws_session(websocket: WebSocket, session_id: str):
    # TODO: auth — verify session belongs to caller
    await manager.connect(session_id, websocket)
    try:
        while True:
            # keep-alive: discard any client pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
