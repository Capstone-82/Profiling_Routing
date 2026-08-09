from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes.connection import router as connection_router

app = FastAPI(
    title="Profiling & Routing Platform API",
    description="Backend service managing AWS Bedrock connections, Model Registry, and Model Dispatch",
    version="0.1.0"
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

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "backend", "version": "0.1.0"}

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
