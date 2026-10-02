from sqlalchemy import select

from app.database import SessionLocal
from app.models import User
from app.utils.security import hash_password


db = SessionLocal()

try:
    email = "admin@example.com"
    username = "admin"
    password = "Admin@123"

    existing_user = db.execute(
        select(User).where(User.email == email)
    ).scalar_one_or_none()

    if existing_user:
        print("Admin already exists.")
    else:
        admin = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="admin",
            is_active=True
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print("Admin created successfully.")
        print(f"ID: {admin.id}")
        print(f"Email: {admin.email}")
        print(f"Username: {admin.username}")

finally:
    db.close()
