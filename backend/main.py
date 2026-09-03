import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes.connection import router as connection_router
from app.routes.prompt import router as prompt_router
from app.routes.governance import router as governance_router
from app.services.routing_service import routing_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Warm up ML artifacts / RoutingService singleton
    logger.info("Starting up: Loading Prompt Profiling and Model Routing artifacts...")
    try:
        routing_service.initialize()
    except Exception as e:
        logger.warning(f"Background ML warmup deferred: {e}")
    yield
    # Shutdown
    logger.info("Shutting down API service...")

app = FastAPI(
    title="Profiling & Routing Platform API",
    description="Backend service managing AWS Bedrock connections, Model Registry, Prompt Profiling, Model Routing, and Governance Rules",
    version="0.2.0",
    lifespan=lifespan
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(connection_router)
app.include_router(prompt_router)
app.include_router(governance_router)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "backend",
        "version": "0.2.0",
        "routing_ready": routing_service.is_initialized
    }

@app.get("/cloudformation/template.yaml")
@app.get("/api/cloudformation/download")
async def get_cloudformation_template():
    """Serve the CloudFormation YAML template for AWS IAM Role setup."""
    from fastapi.responses import FileResponse
    import os
    file_path = os.path.join(os.path.dirname(__file__), "cloudformation", "bedrock-role-template.yaml")
    return FileResponse(
        path=file_path,
        media_type="text/yaml",
        filename="bedrock-role-template.yaml"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
