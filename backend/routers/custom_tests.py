from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import CustomTest, CtrlWork
from schemas import (
    CustomTestCreate, CustomTestUpdate, CustomTestOut,
    CtrlWorkCreate,   CtrlWorkUpdate,   CtrlWorkOut,
)

router = APIRouter(tags=["custom"])

# ═══════════════════════════════════════════════════════
# CUSTOM TESTS
# ═══════════════════════════════════════════════════════

@router.get("/api/custom-tests", response_model=list[CustomTestOut])
async def list_custom_tests(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CustomTest).order_by(CustomTest.created_at))
    return res.scalars().all()

@router.post("/api/custom-tests", response_model=CustomTestOut)
async def create_custom_test(data: CustomTestCreate, db: AsyncSession = Depends(get_db)):
    test = CustomTest(**data.model_dump())
    db.add(test)
    await db.commit()
    await db.refresh(test)
    return test

@router.put("/api/custom-tests/{test_id}", response_model=CustomTestOut)
async def update_custom_test(test_id: int, data: CustomTestUpdate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CustomTest).where(CustomTest.id == test_id))
    test = res.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Тест не найден")
    for k, v in data.model_dump().items():
        setattr(test, k, v)
    await db.commit()
    await db.refresh(test)
    return test

@router.delete("/api/custom-tests/{test_id}")
async def delete_custom_test(test_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CustomTest).where(CustomTest.id == test_id))
    test = res.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Тест не найден")
    await db.delete(test)
    await db.commit()
    return {"ok": True}

# ═══════════════════════════════════════════════════════
# CTRL WORKS
# ═══════════════════════════════════════════════════════

@router.get("/api/ctrl-works", response_model=list[CtrlWorkOut])
async def list_ctrl_works(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CtrlWork).order_by(CtrlWork.created_at))
    return res.scalars().all()

@router.post("/api/ctrl-works", response_model=CtrlWorkOut)
async def create_ctrl_work(data: CtrlWorkCreate, db: AsyncSession = Depends(get_db)):
    cw = CtrlWork(**data.model_dump())
    db.add(cw)
    await db.commit()
    await db.refresh(cw)
    return cw

@router.put("/api/ctrl-works/{cw_id}", response_model=CtrlWorkOut)
async def update_ctrl_work(cw_id: int, data: CtrlWorkUpdate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CtrlWork).where(CtrlWork.id == cw_id))
    cw = res.scalar_one_or_none()
    if not cw:
        raise HTTPException(404, "Контрольная не найдена")
    for k, v in data.model_dump().items():
        setattr(cw, k, v)
    await db.commit()
    await db.refresh(cw)
    return cw

@router.patch("/api/ctrl-works/{cw_id}/toggle", response_model=CtrlWorkOut)
async def toggle_ctrl_work(cw_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CtrlWork).where(CtrlWork.id == cw_id))
    cw = res.scalar_one_or_none()
    if not cw:
        raise HTTPException(404, "Контрольная не найдена")
    cw.active = not cw.active
    await db.commit()
    await db.refresh(cw)
    return cw

@router.delete("/api/ctrl-works/{cw_id}")
async def delete_ctrl_work(cw_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CtrlWork).where(CtrlWork.id == cw_id))
    cw = res.scalar_one_or_none()
    if not cw:
        raise HTTPException(404, "Контрольная не найдена")
    await db.delete(cw)
    await db.commit()
    return {"ok": True}