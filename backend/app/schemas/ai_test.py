from pydantic import BaseModel, Field, model_validator
from typing import List, Literal


class TestBlueprint(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    subject: str = Field(..., min_length=2, max_length=100)
    topic: str = Field(..., min_length=2, max_length=150)

    total_questions: int = Field(..., ge=1, le=100)

    easy_questions: int = Field(..., ge=0)
    medium_questions: int = Field(..., ge=0)
    hard_questions: int = Field(..., ge=0)

    mcq_questions: int = Field(..., ge=0)
    coding_questions: int = Field(..., ge=0)

    duration_minutes: int = Field(..., ge=5, le=300)

    @model_validator(mode="after")
    def validate_distribution(self):
        difficulty_total = (
            self.easy_questions
            + self.medium_questions
            + self.hard_questions
        )

        type_total = (
            self.mcq_questions
            + self.coding_questions
        )

        if difficulty_total != self.total_questions:
            raise ValueError(
                "Easy + Medium + Hard must equal Total Questions."
            )

        if type_total != self.total_questions:
            raise ValueError(
                "MCQ + Coding must equal Total Questions."
            )

        return self


class MCQQuestion(BaseModel):
    question_type: Literal["mcq"]
    difficulty: Literal["easy", "medium", "hard"]
    question: str
    options: List[str] = Field(..., min_length=4, max_length=4)
    correct_answer: str
    explanation: str
    marks: int = Field(default=1, ge=1)


class CodingQuestion(BaseModel):
    question_type: Literal["coding"]
    difficulty: Literal["easy", "medium", "hard"]
    title: str
    problem_statement: str
    input_format: str
    output_format: str
    constraints: List[str]
    sample_input: str
    sample_output: str
    explanation: str
    programming_language: str
    marks: int = Field(default=5, ge=1)


class GeneratedTest(BaseModel):
    title: str
    subject: str
    topic: str
    duration_minutes: int
    questions: List[dict]
