from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.gemini_service import gemini_service


router = APIRouter(
    prefix="/admin/ai",
    tags=["AI Test Generation"]
)


class GenerateTestRequest(BaseModel):

    subject: str = Field(
        ...,
        min_length=2,
        max_length=100
    )

    topics: list[str] = Field(
        default_factory=list
    )

    total_questions: int = Field(
        ...,
        ge=1,
        le=100
    )

    easy_questions: int = Field(
        ...,
        ge=0,
        le=100
    )

    medium_questions: int = Field(
        ...,
        ge=0,
        le=100
    )

    hard_questions: int = Field(
        ...,
        ge=0,
        le=100
    )

    coding_questions: int = Field(
        ...,
        ge=0,
        le=100
    )

    duration_minutes: int = Field(
        ...,
        ge=5,
        le=300
    )


@router.post("/generate-test")
def generate_test(request: GenerateTestRequest):

    if (
        request.easy_questions
        + request.medium_questions
        + request.hard_questions
        != request.total_questions
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Easy + Medium + Hard must equal "
                "Total Questions."
            )
        )

    if request.coding_questions > request.total_questions:
        raise HTTPException(
            status_code=400,
            detail=(
                "Coding questions cannot exceed "
                "Total Questions."
            )
        )

    try:

        result = gemini_service.generate_test(
            subject=request.subject,
            topics=request.topics,
            total_questions=request.total_questions,
            easy_questions=request.easy_questions,
            medium_questions=request.medium_questions,
            hard_questions=request.hard_questions,
            coding_questions=request.coding_questions,
            duration_minutes=request.duration_minutes,
        )

        return {
            "success": True,
            "message": "Test generated successfully.",
            "test": result,
        }

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc)
        )

    except Exception as exc:

        print("GEMINI ERROR:", exc)

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to generate test using Gemini."
            )
        )
