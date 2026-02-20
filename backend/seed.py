from sqlmodel import Session, SQLModel, create_engine, select
from database import engine
from models import User, Tenant, Course, AcademicGrade, Group, Period, Student
from security import get_password_hash

def seed():
    # Dropping and creating tables for a clean start
    print("Clearing database...")
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        print("Seeding initial data...")
        
        # 1. Admin User
        admin = User(
            username="admin",
            password=get_password_hash("admin123"),
            role="admin",
            full_name="Administrador del Sistema"
        )
        session.add(admin)
        
        # 2. Tenant
        tenant = Tenant(nombre_escuela="VIKOTECH Academy")
        session.add(tenant)
        session.commit()
        
        # 3. Setup Academic Structure (Grades & Groups)
        grades_data = [
            {"name": "1° Semestre", "groups": ["A", "B"]},
            {"name": "3° Semestre", "groups": ["A"]},
            {"name": "5° Semestre", "groups": ["A", "B"]}
        ]
        
        group_map = {} # "1° Semestre-A" -> group_id

        for g_data in grades_data:
            grade = AcademicGrade(name=g_data["name"], tenant_id=tenant.id)
            session.add(grade)
            session.commit()
            
            for g_name in g_data["groups"]:
                group = Group(name=g_name, academic_grade_id=grade.id)
                session.add(group)
                session.commit()
                group_map[f"{g_data['name']}-{g_name}"] = group.id

        # 4. Setup Periods (Parciales)
        periods_data = [
            {"name": "Parcial 1", "weight": 0.3},
            {"name": "Parcial 2", "weight": 0.3},
            {"name": "Parcial 3", "weight": 0.4}
        ]
        
        for p_data in periods_data:
            period = Period(
                name=p_data["name"], 
                weight=p_data["weight"], 
                tenant_id=tenant.id,
                is_active=True
            )
            session.add(period)
        session.commit()
        
        # 5. Teacher
        teacher = User(
            username="profesor",
            password=get_password_hash("123"),
            role="teacher",
            full_name="Profesor de Historia"
        )
        session.add(teacher)
        session.commit()
        
        # 6. Initial Course
        course = Course(
            tenant_id=tenant.id,
            teacher_id=teacher.id,
            nombre="Ciencias Físicas",
            periodo="2024-1"
        )
        session.add(course)
        session.commit()

        # 7. Initial Students (Linked to User & Group)
        students_data = [
            {"name": "Alumno Ejemplo", "matricula": "FIX1234", "group": "1° Semestre-A"},
            {"name": "Maria Lopez", "matricula": "MARIA001", "group": "1° Semestre-B"},
            {"name": "Juan Perez", "matricula": "JUAN001", "group": "3° Semestre-A"}
        ]

        from models import Enrollment

        for s_data in students_data:
            # Create User
            s_user = User(
                username=s_data["matricula"],
                password=get_password_hash(s_data["matricula"]),
                role="student",
                full_name=s_data["name"]
            )
            session.add(s_user)
            session.commit()
            
            # Create Student
            student = Student(
                tenant_id=tenant.id,
                nombre=s_data["name"],
                matricula=s_data["matricula"],
                user_id=s_user.id,
                group_id=group_map.get(s_data["group"])
            )
            session.add(student)
            session.commit()

            # Enroll "Alumno Ejemplo" in course
            if s_data["matricula"] == "FIX1234":
                enrollment = Enrollment(course_id=course.id, student_id=student.id)
                session.add(enrollment)
                session.commit()
        
        print("Seed completed successfully with Relational Schema!")

if __name__ == "__main__":
    seed()
