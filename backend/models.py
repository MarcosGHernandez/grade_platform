from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password: str # Plain text for this basic demo
    role: str # 'admin', 'teacher', 'student'
    full_name: str

    courses: List["Course"] = Relationship(back_populates="teacher")

class EvaluationCriteria(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(foreign_key="course.id")
    period_id: int = Field(foreign_key="period.id") # Link to Period
    name: str
    weight_percentage: float

    course: Optional["Course"] = Relationship(back_populates="criteria")
    period: Optional["Period"] = Relationship(back_populates="criteria")
    grades: List["Grade"] = Relationship(back_populates="criteria")

class Grade(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    enrollment_id: int = Field(foreign_key="enrollment.id")
    criteria_id: int = Field(foreign_key="evaluationcriteria.id")
    score: float

    enrollment: Optional["Enrollment"] = Relationship(back_populates="grades")
    criteria: Optional[EvaluationCriteria] = Relationship(back_populates="grades")

class Tenant(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre_escuela: str
    
    courses: List["Course"] = Relationship(back_populates="tenant")
    students: List["Student"] = Relationship(back_populates="tenant")
    periods: List["Period"] = Relationship(back_populates="tenant")

class AcademicGrade(SQLModel, table=True): # "Grado" (1°, 2°, 3°)
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str # "1° Semestre"
    tenant_id: int = Field(foreign_key="tenant.id")
    groups: List["Group"] = Relationship(back_populates="academic_grade")

class Group(SQLModel, table=True): # "Grupo" (A, B, C)
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str # "A"
    academic_grade_id: int = Field(foreign_key="academicgrade.id")
    academic_grade: Optional[AcademicGrade] = Relationship(back_populates="groups")
    students: List["Student"] = Relationship(back_populates="group")

class Period(SQLModel, table=True): # "Parcial 1", "Parcial 2"
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenant.id")
    name: str
    weight: float # (0.0 - 1.0) Contribution to final grade
    is_active: bool = True
    is_locked: bool = False
    
    tenant: Optional[Tenant] = Relationship(back_populates="periods")
    criteria: List["EvaluationCriteria"] = Relationship(back_populates="period")

class GradeAudit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    grade_id: int = Field(foreign_key="grade.id")
    actor_id: int = Field(foreign_key="user.id") # Who made the change
    previous_score: float
    new_score: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Course(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenant.id")
    teacher_id: Optional[int] = Field(default=None, foreign_key="user.id")
    nombre: str
    periodo: Optional[str] = "2024-1" # Added for more "seriousness"
    
    tenant: Optional[Tenant] = Relationship(back_populates="courses")
    teacher: Optional[User] = Relationship(back_populates="courses")
    enrollments: List["Enrollment"] = Relationship(back_populates="course")
    criteria: List["EvaluationCriteria"] = Relationship(back_populates="course")

class Student(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenant.id")
    nombre: str
    matricula: str = Field(index=True, unique=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    group_id: Optional[int] = Field(default=None, foreign_key="group.id")
    
    tenant: Optional[Tenant] = Relationship(back_populates="students")
    group: Optional[Group] = Relationship(back_populates="students")
    enrollments: List["Enrollment"] = Relationship(back_populates="student")

class Enrollment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(foreign_key="course.id")
    student_id: int = Field(foreign_key="student.id")
    calificacion_final: Optional[float] = None

    course: Optional[Course] = Relationship(back_populates="enrollments")
    student: Optional[Student] = Relationship(back_populates="enrollments")
    grades: List["Grade"] = Relationship(back_populates="enrollment")
