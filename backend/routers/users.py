from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User
from schemas import UserCreate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])

@router.post("/register", response_model=UserOut)
async def register_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    if not data.first_name.strip() or not data.last_name.strip():
        raise HTTPException(400, "Имя и фамилия обязательны")
    if not data.grade.strip():
        raise HTTPException(400, "Класс обязателен")

    # Ищем существующего пользователя по ФИО + класс
    res = await db.execute(
        select(User).where(
            User.first_name == data.first_name.strip(),
            User.last_name  == data.last_name.strip(),
            User.grade      == data.grade.strip()
        )
    )
    existing = res.scalar_one_or_none()
    if existing:
        return existing

    # Создаём нового
    user = User(
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        grade=data.grade.strip(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return user