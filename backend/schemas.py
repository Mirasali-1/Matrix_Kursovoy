from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# ── Users ──────────────────────────────────────────────

class UserCreate(BaseModel):
    first_name: str
    last_name:  str
    grade:      str

class UserOut(BaseModel):
    id:         int
    first_name: str
    last_name:  str
    grade:      str
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# ── Test Results ───────────────────────────────────────

class TestResultCreate(BaseModel):
    user_id:          int
    test_id:          int
    test_title:       str
    total_questions:  int
    correct_answers:  int
    percentage:       int
    time_spent:       int
    detailed_results: str

class TestResultOut(BaseModel):
    id:               int
    user_id:          int
    test_id:          int
    test_title:       str
    total_questions:  int
    correct_answers:  int
    percentage:       int
    time_spent:       int
    detailed_results: str
    timestamp:        Optional[datetime] = None
    class Config:
        from_attributes = True

# ── Custom Tests ───────────────────────────────────────

class CustomTestCreate(BaseModel):
    title:        str
    desc:         str = ""
    difficulty:   str = "medium"
    diff_label:   str = "Средний"
    questions:    int
    time:         int
    topics:       str   # JSON
    topic_keys:   str   # JSON
    topic_counts: str   # JSON

class CustomTestUpdate(CustomTestCreate):
    pass

class CustomTestOut(BaseModel):
    id:           int
    title:        str
    desc:         str
    difficulty:   str
    diff_label:   str
    questions:    int
    time:         int
    topics:       str
    topic_keys:   str
    topic_counts: str
    created_at:   Optional[datetime] = None
    class Config:
        from_attributes = True

# ── Ctrl Works ─────────────────────────────────────────

class CtrlWorkCreate(BaseModel):
    title:        str
    desc:         str = ""
    grade:        str = ""
    qcount:       int
    time:         int
    topics:       str   # JSON
    topic_keys:   str   # JSON
    topic_counts: str   # JSON
    active:       bool = True

class CtrlWorkUpdate(CtrlWorkCreate):
    pass

class CtrlWorkOut(BaseModel):
    id:           int
    title:        str
    desc:         str
    grade:        str
    qcount:       int
    time:         int
    topics:       str
    topic_keys:   str
    topic_counts: str
    active:       bool
    created_at:   Optional[datetime] = None
    class Config:
        from_attributes = True