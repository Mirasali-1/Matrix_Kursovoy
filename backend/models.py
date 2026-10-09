from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id           = Column(Integer, primary_key=True, index=True)
    first_name   = Column(String(100), nullable=False)
    last_name    = Column(String(100), nullable=False)
    grade        = Column(String(10),  nullable=False)
    created_at   = Column(DateTime, server_default=func.now())
    test_results = relationship("TestResult", back_populates="user", cascade="all, delete")

class TestResult(Base):
    __tablename__ = "test_results"
    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    test_id          = Column(Integer, nullable=False)
    test_title       = Column(String(200), nullable=False)
    total_questions  = Column(Integer, nullable=False)
    correct_answers  = Column(Integer, nullable=False)
    percentage       = Column(Integer, nullable=False)
    time_spent       = Column(Integer, nullable=False)
    detailed_results = Column(Text, nullable=False)
    timestamp        = Column(DateTime, server_default=func.now())
    user = relationship("User", back_populates="test_results")

class CustomTest(Base):
    __tablename__ = "custom_tests"
    id           = Column(Integer, primary_key=True, index=True)
    title        = Column(String(200), nullable=False)
    desc         = Column(String(500), nullable=False, default="")
    difficulty   = Column(String(20),  nullable=False, default="medium")
    diff_label   = Column(String(20),  nullable=False, default="Средний")
    questions    = Column(Integer,     nullable=False)
    time         = Column(Integer,     nullable=False)
    topics       = Column(Text,        nullable=False)   # JSON array
    topic_keys   = Column(Text,        nullable=False)   # JSON array
    topic_counts = Column(Text,        nullable=False)   # JSON object
    created_at   = Column(DateTime,    server_default=func.now())

class CtrlWork(Base):
    __tablename__ = "ctrl_works"
    id           = Column(Integer, primary_key=True, index=True)
    title        = Column(String(200), nullable=False)
    desc         = Column(String(500), nullable=False, default="")
    grade        = Column(String(10),  nullable=False, default="")
    qcount       = Column(Integer,     nullable=False)
    time         = Column(Integer,     nullable=False)
    topics       = Column(Text,        nullable=False)   # JSON array
    topic_keys   = Column(Text,        nullable=False)   # JSON array
    topic_counts = Column(Text,        nullable=False)   # JSON object
    active       = Column(Boolean,     nullable=False, default=True)
    created_at   = Column(DateTime,    server_default=func.now())