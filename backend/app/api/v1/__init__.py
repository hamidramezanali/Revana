from fastapi import APIRouter

from app.api.v1 import agent, health

router = APIRouter(prefix="/v1")
router.include_router(health.router)
router.include_router(agent.router)

from app.goal_workspace import router as workspace_router

router.include_router(workspace_router)
