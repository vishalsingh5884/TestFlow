import json

from google import genai
from google.genai import types

from app.config import settings


class GeminiService:

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not configured.")

        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

    def generate_test(
        self,
        subject: str,
        topics: list[str],
        total_questions: int,
        easy_questions: int,
        medium_questions: int,
        hard_questions: int,
        coding_questions: int,
        duration_minutes: int,
    ):

        if (
            easy_questions
            + medium_questions
            + hard_questions
            != total_questions
        ):
            raise ValueError(
                "Easy + Medium + Hard must equal total questions."
            )

        if coding_questions > total_questions:
            raise ValueError(
                "Coding questions cannot exceed total questions."
            )

        topic_text = ", ".join(topics) if topics else "General syllabus"

        prompt = f"""
You are an expert examination paper generator.

Generate a high-quality online examination test.

TEST CONFIGURATION
------------------
Subject: {subject}
Topics: {topic_text}
Total Questions: {total_questions}

Difficulty Distribution:
Easy: {easy_questions}
Medium: {medium_questions}
Hard: {hard_questions}

Coding Questions:
{coding_questions}

Duration:
{duration_minutes} minutes

IMPORTANT RULES
---------------
1. Generate exactly {total_questions} questions.
2. Exactly {easy_questions} questions must be Easy.
3. Exactly {medium_questions} questions must be Medium.
4. Exactly {hard_questions} questions must be Hard.
5. Exactly {coding_questions} questions must be coding questions.
6. Coding questions should preferably test programming logic,
   algorithms, debugging, output prediction, or implementation.
7. Non-coding questions can be conceptual or multiple-choice.
8. Avoid duplicate questions.
9. Questions must be appropriate for a college-level online test.
10. Every MCQ must have exactly four options.
11. Every question must have one correct answer.
12. Provide a short explanation for the correct answer.
13. Coding questions should contain a clear problem statement.
14. For coding questions, provide the expected answer/explanation,
    but DO NOT require a specific programming language unless
    the question specifies one.
15. Return ONLY valid JSON.
16. Do not use markdown.
17. The JSON must follow the exact structure below.

JSON STRUCTURE
--------------
{{
    "test_title": "string",
    "subject": "string",
    "duration_minutes": {duration_minutes},
    "total_questions": {total_questions},
    "difficulty_distribution": {{
        "easy": {easy_questions},
        "medium": {medium_questions},
        "hard": {hard_questions}
    }},
    "coding_questions": {coding_questions},
    "questions": [
        {{
            "question_number": 1,
            "question_type": "mcq",
            "difficulty": "easy",
            "is_coding": false,
            "question": "Question text",
            "options": [
                "Option A",
                "Option B",
                "Option C",
                "Option D"
            ],
            "correct_answer": "Option A",
            "explanation": "Short explanation"
        }}
    ]
}}
"""

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            ),
        )

        if not response.text:
            raise ValueError("Gemini returned an empty response.")

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError as exc:
            raise ValueError(
                "Gemini returned invalid JSON."
            ) from exc

        self._validate_result(
            result=result,
            total_questions=total_questions,
            easy_questions=easy_questions,
            medium_questions=medium_questions,
            hard_questions=hard_questions,
            coding_questions=coding_questions,
        )

        return result

    @staticmethod
    def _validate_result(
        result,
        total_questions,
        easy_questions,
        medium_questions,
        hard_questions,
        coding_questions,
    ):

        questions = result.get("questions", [])

        if len(questions) != total_questions:
            raise ValueError(
                f"Expected {total_questions} questions, "
                f"but Gemini returned {len(questions)}."
            )

        difficulty_count = {
            "easy": 0,
            "medium": 0,
            "hard": 0,
        }

        coding_count = 0

        for question in questions:

            difficulty = str(
                question.get("difficulty", "")
            ).lower()

            if difficulty not in difficulty_count:
                raise ValueError(
                    f"Invalid difficulty: {difficulty}"
                )

            difficulty_count[difficulty] += 1

            if question.get("is_coding") is True:
                coding_count += 1

        if difficulty_count["easy"] != easy_questions:
            raise ValueError(
                "Generated Easy question count does not match requested count."
            )

        if difficulty_count["medium"] != medium_questions:
            raise ValueError(
                "Generated Medium question count does not match requested count."
            )

        if difficulty_count["hard"] != hard_questions:
            raise ValueError(
                "Generated Hard question count does not match requested count."
            )

        if coding_count != coding_questions:
            raise ValueError(
                "Generated coding question count does not match requested count."
            )


gemini_service = GeminiService()
