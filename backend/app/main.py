import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import router as v1_router
from app.body_limit import AgentBodyLimit
from app.config import get_settings
from app.errors import register_error_handlers


def create_app() -> FastAPI:
    settings = get_settings()
    if settings.environment != "development" or os.environ.get("VERCEL"):
        raise RuntimeError(
            "The single-user agent requires local development hosting. See docs/agent-roadmap.md."
        )
    app = FastAPI(title="Revana API", version="0.1.0")
    # Bearer-token auth only, so credentials/cookies are not allowed cross-origin.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def local_agent_only(request: Request, call_next):
        if request.url.path.startswith("/v1/agent"):
            if request.url.hostname not in {"localhost", "127.0.0.1", "::1", "testserver"} or (
                request.client and request.client.host not in {"127.0.0.1", "::1", "testclient"}
            ):
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": {
                            "code": "local_only",
                            "message": "The single-user agent is available locally only.",
                        }
                    },
                )
            origin = request.headers.get("origin")
            if origin and origin not in settings.cors_origins:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": {
                            "code": "origin_denied",
                            "message": "This browser origin is not allowed.",
                        }
                    },
                )
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    app.add_middleware(AgentBodyLimit)
    register_error_handlers(app)
    app.include_router(v1_router)
    return app


app = create_app()
