import json
import os
import requests


class AITestGenerator:
    def __init__(self):
        self.api_key = os.getenv("AI_API_KEY")
        self.base_url = os.getenv(
            "AI_BASE_URL",
            "https://api.openai.com/v1/chat/completions"
        )
        self.model = os.getenv(
            "AI_MODEL",
            "gpt-4o-mini"
        )

    def generate_test(self, blueprint):
        if not self.api_key:
            raise RuntimeError(
                "AI_API_KEY is not configured. "
                "Add your AI API key to the backend environment."
            )

        prompt = self._build_prompt(blueprint)

        payload = {
            "model": self.model,
            "temperature": 0.4,
            "response_format": {
                "type": "json_object"
            },
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an expert examination question generator. "
                        "Generate accurate, original, educational questions. "
                        "Follow the requested distribution exactly. "
                        "Return ONLY valid JSON."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }

        response = requests.post(
            self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=120
        )

        if not response.ok:
            try:
                error_data = response.json()
            except Exception:
                error_data = response.text

            raise RuntimeError(
                f"AI provider error: {error_data}"
            )

        data = response.json()

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError):
            raise RuntimeError(
                "AI provider returned an unexpected response."
            )

        try:
            generated = json.loads(content)
        except json.JSONDecodeError:
            raise RuntimeError(
                "AI returned invalid JSON."
            )

        self._validate_generated_test(
            generated,
            blueprint
        )

        return generated

    def _build_prompt(self, blueprint):
        return f"""
Generate a complete online examination.

TEST INFORMATION
Title: {blueprint.title}
Subject: {blueprint.subject}
Topic: {blueprint.topic}
Duration: {blueprint.duration_minutes} minutes

TOTAL QUESTIONS
{blueprint.total_questions}

DIFFICULTY DISTRIBUTION
Easy: {blueprint.easy_questions}
Medium: {blueprint.medium_questions}
Hard: {blueprint.hard_questions}

QUESTION TYPE DISTRIBUTION
MCQ: {blueprint.mcq_questions}
Coding: {blueprint.coding_questions}

IMPORTANT REQUIREMENTS

1. Generate exactly {blueprint.total_questions} questions.

2. Difficulty must be exactly:
   Easy = {blueprint.easy_questions}
   Medium = {blueprint.medium_questions}
   Hard = {blueprint.hard_questions}

3. Question type must be exactly:
   MCQ = {blueprint.mcq_questions}
   Coding = {blueprint.coding_questions}

4. MCQ questions must contain:
   - question_type = "mcq"
   - difficulty
   - question
   - exactly 4 options
   - correct_answer
   - explanation
   - marks

5. Coding questions must contain:
   - question_type = "coding"
   - difficulty
   - title
   - problem_statement
   - input_format
   - output_format
   - constraints
   - sample_input
   - sample_output
   - explanation
   - programming_language
   - marks

6. Coding questions must be genuine programming problems.
   Do not convert MCQs into coding questions.

7. Questions should test understanding rather than simply
   memorization.

8. Do not duplicate questions.

9. Ensure the correct answer for every MCQ is actually present
   in its four options.

10. Return JSON using exactly this structure:

{{
    "title": "{blueprint.title}",
    "subject": "{blueprint.subject}",
    "topic": "{blueprint.topic}",
    "duration_minutes": {blueprint.duration_minutes},
    "questions": [
        {{
            "question_type": "mcq",
            "difficulty": "easy",
            "question": "...",
            "options": ["...", "...", "...", "..."],
            "correct_answer": "...",
            "explanation": "...",
            "marks": 1
        }},
        {{
            "question_type": "coding",
            "difficulty": "medium",
            "title": "...",
            "problem_statement": "...",
            "input_format": "...",
            "output_format": "...",
            "constraints": ["..."],
            "sample_input": "...",
            "sample_output": "...",
            "explanation": "...",
            "programming_language": "Python",
            "marks": 5
        }}
    ]
}}
"""

    def _validate_generated_test(self, generated, blueprint):
        questions = generated.get("questions", [])

        if len(questions) != blueprint.total_questions:
            raise RuntimeError(
                "AI generated the wrong number of questions."
            )

        difficulty_counts = {
            "easy": 0,
            "medium": 0,
            "hard": 0
        }

        type_counts = {
            "mcq": 0,
            "coding": 0
        }

        for question in questions:
            question_type = question.get("question_type")
            difficulty = question.get("difficulty")

            if question_type not in type_counts:
                raise RuntimeError(
                    "AI generated an invalid question type."
                )

            if difficulty not in difficulty_counts:
                raise RuntimeError(
                    "AI generated an invalid difficulty."
                )

            type_counts[question_type] += 1
            difficulty_counts[difficulty] += 1

            if question_type == "mcq":
                options = question.get("options", [])

                if len(options) != 4:
                    raise RuntimeError(
                        "An MCQ does not contain exactly 4 options."
                    )

                if question.get("correct_answer") not in options:
                    raise RuntimeError(
                        "An MCQ has an invalid correct answer."
                    )

        expected_difficulty = {
            "easy": blueprint.easy_questions,
            "medium": blueprint.medium_questions,
            "hard": blueprint.hard_questions
        }

        expected_types = {
            "mcq": blueprint.mcq_questions,
            "coding": blueprint.coding_questions
        }

        if difficulty_counts != expected_difficulty:
            raise RuntimeError(
                "AI did not follow the requested difficulty distribution."
            )

        if type_counts != expected_types:
            raise RuntimeError(
                "AI did not follow the requested question-type distribution."
            )
