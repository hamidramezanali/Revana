"""Bound agent request bodies before JSON decoding; never log buffered bytes."""

from starlette.responses import JSONResponse


class AgentBodyLimit:
    def __init__(self, app, limit=4_000_000):
        self.app = app
        self.limit = limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith(("/v1/agent", "/v1/workspace")):
            return await self.app(scope, receive, send)
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > self.limit:
                response = JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "body_too_large",
                            "message": "These photos are too large. Try fewer or smaller photos.",
                        }
                    },
                    headers={"Cache-Control": "no-store"},
                )
                return await response(scope, receive, send)
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        body = b"".join(chunks)
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
