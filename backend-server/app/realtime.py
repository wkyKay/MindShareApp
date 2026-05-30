from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class RealtimeManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        user_connections = self._connections.get(user_id)
        if not user_connections:
            return
        user_connections.discard(websocket)
        if not user_connections:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, event: dict[str, Any]) -> None:
        user_connections = list(self._connections.get(user_id, set()))
        stale_connections: list[WebSocket] = []
        for connection in user_connections:
            try:
                await connection.send_json(event)
            except Exception:
                stale_connections.append(connection)
        for connection in stale_connections:
            self.disconnect(user_id, connection)


realtime_manager = RealtimeManager()
