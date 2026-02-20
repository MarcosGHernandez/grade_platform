from sqlmodel import Session, select
from database import engine
from models import User, Student, Course, Tenant
from security import get_password_hash

def sync_data():
    with Session(engine) as session:
        print("--- Syncing Data ---")
        
        # 1. Ensure Tenant
        tenant = session.get(Tenant, 1)
        if not tenant:
            tenant = Tenant(id=1, nombre_escuela="VIKOTECH")
            session.add(tenant)
            session.commit()
            print("Created Tenant")

        # 2. Sync Arquimedes (Student)
        # Check if User exists but Student doesn't
        user_arq = session.exec(select(User).where(User.username == "arquimedes")).first()
        if not user_arq:
             # Create if totally missing (optional, but good for testing)
            user_arq = User(username="arquimedes", password=get_password_hash("123"), role="student", full_name="Arquímedes de Siracusa")
            session.add(user_arq)
            session.commit()
            print("Created User: Arquimedes")

        student_arq = session.exec(select(Student).where(Student.matricula == "arquimedes")).first()
        if not student_arq:
            student_arq = Student(nombre="Arquímedes de Siracusa", matricula="arquimedes", tenant_id=1)
            session.add(student_arq)
            session.commit()
            print("Created Student Profile: Arquimedes")
        
        # 3. Check Professor Course Assignment
        prof = session.exec(select(User).where(User.username == "profesor")).first()
        if prof:
            # Ensure he has a course
            course = session.exec(select(Course).where(Course.teacher_id == prof.id)).first()
            if not course:
                # Assign 'Historia' to him if it exists but has no teacher, or create it
                historia = session.exec(select(Course).where(Course.nombre == "Historia")).first()
                if historia:
                    historia.teacher_id = prof.id
                    session.add(historia)
                    print(f"Assigned 'Historia' to {prof.username}")
                else:
                    new_course = Course(nombre="Historia", teacher_id=prof.id, tenant_id=1, periodo="2024-1")
                    session.add(new_course)
                    print(f"Created 'Historia' for {prof.username}")
            session.commit()

        print("--- Sync Complete ---")

if __name__ == "__main__":
    sync_data()
