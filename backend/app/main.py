from fastapi import FastAPI

from . import models
from .api import router
from .database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AntiCoach Platform API", version="0.1.0")
app.include_router(router)


@app.get("/")
def read_root():
    return {"message": "AntiCoach Platform API", "docs": "/docs"}
