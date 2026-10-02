from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.admin import CreateStudentRequest, StudentResponse
from app.utils.dependencies import require_admin
from app.utils.security import hash_password


router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


@router.post(
    "/students",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED
)
def create_student(
    student_data: CreateStudentRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    existing_email = db.execute(
        select(User).where(User.email == student_data.email)
    ).scalar_one_or_none()

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="Email already exists"
        )

    existing_username = db.execute(
        select(User).where(User.username == student_data.username)
    ).scalar_one_or_none()

    if existing_username:
        raise HTTPException(
            status_code=409,
            detail="Username already exists"
        )

    student = User(
        username=student_data.username,
        email=student_data.email,
        password_hash=hash_password(student_data.password),
        role="student",
        is_active=True
    )

    db.add(student)
    db.commit()
    db.refresh(student)

    return student


@router.get(
    "/students",
    response_model=list[StudentResponse]
)
def get_students(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    result = db.execute(
        select(User).where(User.role == "student")
    )

    return result.scalars().all()


@router.delete("/students/{user_id}")
def delete_student(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    student = db.get(User, user_id)

    if student is None or student.role != "student":
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    db.delete(student)
    db.commit()

    return {
        "message": "Student deleted successfully"
    }