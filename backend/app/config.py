import os


def _load_dotenv(path: str = ".env") -> None:
    if not os.path.exists(path):
        return

    with open(path, encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()

            if (
                not line
                or line.startswith("#")
                or "=" not in line
            ):
                continue

            key, value = line.split("=", 1)

            os.environ.setdefault(
                key.strip(),
                value.strip().strip("'\"")
            )


_load_dotenv()


class Settings:
    DATABASE_URL: str
    JWT_SECRET_KEY: str
    FRONTEND_URL: str
    GEMINI_API_KEY: str

    def __init__(self) -> None:
        self.DATABASE_URL = os.environ["DATABASE_URL"]
        self.JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
        self.FRONTEND_URL = os.environ["FRONTEND_URL"]

        self.GEMINI_API_KEY = os.environ.get(
            "GEMINI_API_KEY",
            ""
        )


settings = Settings()
