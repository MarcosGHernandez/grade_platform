from sqlmodel import Session, select
from database import engine
from models import User, Student, Course, Enrollment, Grade

def refine_data():
    with Session(engine) as session:
        print("--- Refining Data ---")
        
        # 1. Rename 'profesor' to be recognizable
        prof = session.exec(select(User).where(User.username == "profesor")).first()
        if prof:
            prof.full_name = "Profesor de Historia"
            session.add(prof)
            print(f"Renamed 'profesor' to '{prof.full_name}'")

            # 2. Ensure 'Historia' course
            historia = session.exec(select(Course).where(Course.nombre == "Historia", Course.teacher_id == prof.id)).first()
            if not historia:
                # Check if it exists with another teacher or no teacher
                historia = session.exec(select(Course).where(Course.nombre == "Historia")).first()
                if historia:
                    historia.teacher_id = prof.id
                else:
                    historia = Course(nombre="Historia", teacher_id=prof.id, tenant_id=1, periodo="2024-1")
                session.add(historia)
                print("Ensured 'Historia' course exists and is assigned")
        
        # 3. Clean up Duplicate Arquimedes
        # We want to keep the one linked to User 'arquimedes' (which is matricula='arquimedes')
        # We delete the old one with matricula='S2024001' if it has no user
        old_arq = session.exec(select(Student).where(Student.matricula == "S2024001")).first()
        if old_arq:
            # Check if enrolled, if not, delete
            if not old_arq.enrollments:
                session.delete(old_arq)
                print("Deleted orphan Arquimedes (S2024001)")
            else:
                print("Kept old Arquimedes (has enrollments)")

        session.commit()
        print("--- Refine Complete ---")

if __name__ == "__main__":
    refine_data()
