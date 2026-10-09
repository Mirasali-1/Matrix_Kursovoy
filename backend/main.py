import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import engine, Base
from routers.users import router as users_router
from routers.tests import router as tests_router
from routers.custom_tests import router as custom_tests_router


import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import AsyncSessionLocal
from models import CtrlWork

DEFAULT_CTRL_WORKS = [
    {
        "title": "Контрольная №1 — Базовые операции",
        "desc": "Сложение, умножение на скаляр, транспонирование и определители 2×2",
        "grade": "",
        "qcount": 12,
        "time": 40,
        "topics": json.dumps(["add","add","add","scalar","scalar","scalar","transpose","transpose","det2","det2","det2","det2"]),
        "topic_keys": json.dumps(["add","scalar","transpose","det2"]),
        "topic_counts": json.dumps({"add":3,"scalar":3,"transpose":2,"det2":4}),
        "active": True,
    },
    {
        "title": "Контрольная №2 — Продвинутый уровень",
        "desc": "Умножение матриц, определители 3×3, обратная матрица и системы уравнений",
        "grade": "",
        "qcount": 14,
        "time": 55,
        "topics": json.dumps(["multiply","multiply","multiply","det3","det3","det3","det3","inverse","inverse","inverse","sle","sle","rank","rank"]),
        "topic_keys": json.dumps(["multiply","det3","inverse","sle","rank"]),
        "topic_counts": json.dumps({"multiply":3,"det3":4,"inverse":3,"sle":2,"rank":2}),
        "active": True,
    },
]

async def seed_default_ctrl_works():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(CtrlWork))
        existing = res.scalars().all()
        if existing:
            return  # already seeded
        for data in DEFAULT_CTRL_WORKS:
            db.add(CtrlWork(**data))
        await db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_default_ctrl_works()
    yield

app = FastAPI(title="MatriX Testing System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(tests_router)
app.include_router(custom_tests_router)

FRONTEND = os.path.join(os.path.dirname(__file__), "..", "frontend")

@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(os.path.join(FRONTEND, "index.html"))