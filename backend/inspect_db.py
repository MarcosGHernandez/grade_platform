from sqlmodel import Session, select
from database import engine
from models import User, Course

def inspect():
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        print("Users:")
        for u in users:
            print(f"- {u.id}: {u.username} ({u.role})")
            
        courses = session.exec(select(Course)).all()
        print("\nCourses:")
        for c in courses:
            print(f"- {c.id}: {c.nombre} (Teacher ID: {c.teacher_id})")

if __name__ == "__main__":
    inspect()
