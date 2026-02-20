from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
import csv
import io
import codecs
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from typing import List, Optional, Dict, Any
from database import create_db_and_tables, get_session
from models import User, EvaluationCriteria, Grade, Tenant, Course, Student, Enrollment, AcademicGrade, Group, Period, GradeAudit
from auth import (
    get_password_hash, verify_password, create_access_token, 
    get_current_user, require_admin, require_teacher, ACCESS_TOKEN_EXPIRE_MINUTES
)
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import timedelta

app = FastAPI(title="VIKOTECH Grade Core")

# CORS Configuration
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

@app.get("/")
def health_check():
    return {"status": "ok", "app": "VIKOTECH Grade Core"}

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    full_name: str

class CourseCreate(BaseModel):
    tenant_id: int
    teacher_id: int
    nombre: str
    periodo: Optional[str] = "2024-1"

class EnrollRequest(BaseModel):
    nombre: str
    matricula: str

class CriteriaCreate(BaseModel):
    name: str
    weight_percentage: float
    period_id: int

class BatchGradeItem(BaseModel):
    enrollment_id: int
    criteria_id: int
    score: float

class BatchGradesRequest(BaseModel):
    updates: List[BatchGradeItem]

# --- Helpers ---
def validate_course_access(course_id: int, user: User, session: Session) -> Course:
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if user.role == "admin":
        return course
        
    if user.role == "teacher":
        if course.teacher_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized for this course")
        return course
        
    raise HTTPException(status_code=403, detail="Access denied")

def calculate_period_grade(enrollment_id: int, period_id: int, course_id: int, session: Session) -> float:
    # Get criteria for this period AND this course
    criteria = session.exec(select(EvaluationCriteria).where(
        EvaluationCriteria.period_id == period_id, 
        EvaluationCriteria.course_id == course_id
    )).all()
    
    if not criteria: return 0.0
    
    total_score = 0.0
    for c in criteria:
        # Get grade for this criteria
        grade = session.exec(select(Grade).where(
            Grade.enrollment_id == enrollment_id,
            Grade.criteria_id == c.id
        )).first()
        if grade:
            # Score (0-100) * Weight (0-100) / 100
            total_score += (grade.score * c.weight_percentage) / 100.0
            
    return round(total_score, 2)

def calculate_final_grade(enrollment_id: int, session: Session) -> float:
    # We need the course_id to calculate period grades correctly
    enrollment = session.get(Enrollment, enrollment_id)
    if not enrollment: return 0.0

    # Get all periods
    periods = session.exec(select(Period)).all()
    if not periods: return 0.0
    
    final_grade = 0.0
    total_period_weight = 0.0
    
    for p in periods:
        p_grade = calculate_period_grade(enrollment_id, p.id, enrollment.course_id, session)
        final_grade += p_grade * p.weight 
        total_period_weight += p.weight
        
    if total_period_weight == 0: return 0.0
    
    return round(final_grade, 2)

# --- Endpoints ---

# Master Data: Periods & Groups
@app.get("/periods/", response_model=List[Period])
def get_periods(session: Session = Depends(get_session)):
    return session.exec(select(Period)).all()

class PeriodCreate(BaseModel):
    name: str
    weight: float

@app.post("/periods/", response_model=Period)
def create_period(period: PeriodCreate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    # Check total weight? Or just let them manage it.
    new_period = Period(
        name=period.name,
        weight=period.weight,
        tenant_id=1,
        is_active=True
    )
    session.add(new_period)
    session.commit()
    session.refresh(new_period)
    return new_period

@app.delete("/periods/{period_id}")
def delete_period(period_id: int, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    period = session.get(Period, period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    # Check dependencies (Criteria, Grades?) 
    # For now, allow delete but warn (cascade might fail if DB has foreign keys, need to check models)
    # Models have relationships but maybe not Cascade Delete at DB level.
    # Manual cleanup:
    criteria = session.exec(select(EvaluationCriteria).where(EvaluationCriteria.period_id == period_id)).all()
    for c in criteria:
        session.delete(c) # And their grades?
        
    session.delete(period)
    session.commit()
    return {"status": "success"}

class GroupEnrollRequest(BaseModel):
    group_id: int

@app.post("/courses/{course_id}/enroll-group")
def enroll_group(course_id: int, request: GroupEnrollRequest, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    # 1. Validate Group
    group = session.get(Group, request.group_id)
    if not group:
         raise HTTPException(status_code=404, detail="Group not found")
         
    # 2. Get Students in Group
    students = session.exec(select(Student).where(Student.group_id == request.group_id)).all()
    
    enrolled_count = 0
    for student in students:
        # Check if already enrolled
        exists = session.exec(select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.student_id == student.id
        )).first()
        
        if not exists:
            new_enroll = Enrollment(course_id=course_id, student_id=student.id)
            session.add(new_enroll)
            enrolled_count += 1
            
    session.commit()
    return {"status": "success", "enrolled_count": enrolled_count, "total_students": len(students)}

@app.get("/academic-grades/", response_model=List[AcademicGrade])
def get_academic_grades(session: Session = Depends(get_session)):
    return session.exec(select(AcademicGrade)).all()

@app.get("/groups/", response_model=List[Group])
def get_groups(grade_id: Optional[int] = None, session: Session = Depends(get_session)):
    query = select(Group)
    if grade_id:
        query = query.where(Group.academic_grade_id == grade_id)
    return session.exec(query).all()

class StudentGroupUpdate(BaseModel):
    group_id: int

@app.put("/students/{student_id}/group")
def update_student_group(student_id: int, update: StudentGroupUpdate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    group = session.get(Group, update.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    student.group_id = update.group_id
    session.add(student)
    session.commit()
    return {"status": "success"}

# Auth
@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    username = form_data.username.strip()
    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "role": user.role, 
        "username": user.username,
        "full_name": user.full_name,
        "id": user.id
    }

class UserRead(BaseModel):
    id: int
    username: str
    role: str
    full_name: str

@app.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Admin: User Management
@app.post("/users/", response_model=User)
def create_user(user: UserCreate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    user.username = user.username.strip()
    user.password = get_password_hash(user.password)
    new_user = User(**user.dict())
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user

class TeacherWithCourses(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    courses: List[Course]

@app.get("/users/teachers", response_model=List[TeacherWithCourses])
def get_teachers(session: Session = Depends(get_session)):
    # Fetch teachers with their courses
    teachers = session.exec(select(User).where(User.role == "teacher")).all()
    # SQLModel relationships are lazy by default, but response_model will trigger access. 
    # To be safe and efficient, we should use joinedload or selectinload, but for now specific pydantic model works.
    return teachers

@app.delete("/users/{user_id}")
def delete_user(user_id: int, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If teacher, unlink courses (set teacher_id to null or handle as per req. Safe: Set Null)
    courses = session.exec(select(Course).where(Course.teacher_id == user_id)).all()
    for c in courses:
        c.teacher_id = None # Or delete? Better to keep course orphan than lose it.
        session.add(c)
        
    session.delete(user)
    session.commit()
    return {"status": "success", "message": "User deleted"}

class PasswordChange(BaseModel):
    new_password: str

@app.put("/users/{user_id}/password")
def change_user_password(user_id: int, payload: PasswordChange, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.password = get_password_hash(payload.new_password)
    session.add(user)
    session.commit()
    return {"status": "success", "message": "Password updated"}

@app.delete("/students/{student_id}")
def delete_student_admin(student_id: int, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Cascade delete enrollments is manual in SQLModel usually unless defined in DB
    enrollments = session.exec(select(Enrollment).where(Enrollment.student_id == student_id)).all()
    for e in enrollments:
        # Delete grades
        grades = session.exec(select(Grade).where(Grade.enrollment_id == e.id)).all()
        for g in grades: session.delete(g)
        session.delete(e)
    
    # Enable explicit User delete via Foreign Key or manual
    # If using foreign key, user might remain if not cascaded. 
    # Let's delete the User manually to be sure.
    if student.user_id:
        user = session.get(User, student.user_id)
        if user: session.delete(user)
    else:
        # Fallback: Try finding by matricula
        user = session.exec(select(User).where(User.username == student.matricula)).first()
        if user: session.delete(user)

    session.delete(student)
    session.commit()
    return {"status": "success", "message": "Student and data deleted"}

class StudentUpdate(BaseModel):
    grade: Optional[str] = None
    group: Optional[str] = None

@app.patch("/students/{student_id}")
def update_student(student_id: int, update: StudentUpdate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    if update.grade or update.group:
        # We need both to resolve group_id. If one is missing, use current.
        current_grade = "1° Semestre"
        current_group = "A"
        
        if student.group:
           current_group = student.group.name
           if student.group.academic_grade:
               current_grade = student.group.academic_grade.name
               
        new_grade = update.grade if update.grade else current_grade
        new_group = update.group if update.group else current_group
        
        student.group_id = get_or_create_group(session, new_grade, new_group)
        
        
    session.add(student)
    session.commit()
    session.refresh(student)
    return student




class StudentRead(BaseModel):
    id: int
    nombre: str
    matricula: str
    tenant_id: int
    user_id: Optional[int] = None
    group_id: Optional[int] = None
    grade_level: str = "Sin Grado"

@app.get("/students/", response_model=List[StudentRead])
def get_all_students(session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    students = session.exec(select(Student)).all()
    # Populate virtual field
    result = []
    for s in students:
        # Resolve grade level name
        g_level = "Sin Asignar"
        if s.group:
            # Lazy load check
            g_name = s.group.name
            ag_name = s.group.academic_grade.name if s.group.academic_grade else "?"
            g_level = f"{ag_name} - Grupo {g_name}"
        elif s.group_id:
            # Try to fetch if not loaded? For now leave as is or fetch.
            # Ideally we join in the query, but for quick fix:
            pass
            
        result.append(StudentRead(
            id=s.id,
            nombre=s.nombre,
            matricula=s.matricula,
            tenant_id=s.tenant_id,
            user_id=s.user_id,
            group_id=s.group_id,
            grade_level=g_level
        ))
    return result

class StudentCreate(BaseModel):
    nombre: str
    matricula: str
    grade: str = "1° Semestre"
    group: str = "A"

@app.post("/students/", response_model=Student)
def create_student_manual(student: StudentCreate, session: Session = Depends(get_session)):
    # 1. Check if matricula exists
    existing = session.exec(select(Student).where(Student.matricula == student.matricula)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student with this matricula already exists")

    # 2. Ensure User exists (or create one)
    user = session.exec(select(User).where(User.username == student.matricula)).first()
    if not user:
        user = User(
            username=student.matricula,
            password=get_password_hash(student.matricula), # Default password = matricula
            role="student",
            full_name=student.nombre
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    
    # 3. Create Student
    new_student = Student(
        nombre=student.nombre, 
        matricula=student.matricula, 
        group_id=get_or_create_group(session, student.grade, student.group),
        tenant_id=1,
        user_id=user.id
    )
    session.add(new_student)
    session.commit()
    session.refresh(new_student)
    session.refresh(new_student)
    return new_student

@app.post("/students/import")
async def import_students_csv(file: UploadFile = File(...), session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    content = await file.read()
    # Handle potential BOM (Excel exports)
    decoded = content.decode("utf-8-sig")
    csv_reader = csv.DictReader(io.StringIO(decoded))
    
    results = {"created": 0, "updated": 0, "errors": [], "total": 0}
    
    # Expected columns: nombre, matricula, grade_level (optional)
    
    for row in csv_reader:
        results["total"] += 1
        # Normalize keys (case insensitive)
        row = {k.lower().strip(): v for k, v in row.items()}
        
        nombre = row.get("nombre")
        matricula = row.get("matricula")
        grade = row.get("grade", "1° Semestre")
        group_name = row.get("group", "A")
        
        # Support legacy "grade_level" column if present (e.g. "1° Semestre") and default group
        if "grade_level" in row:
             grade = row["grade_level"]
        
        if not nombre or not matricula:
            results["errors"].append(f"Row {results['total']}: Missing nombre or matricula")
            continue
            
        matricula = matricula.strip().upper()
        
        # 1. User consistency
        user = session.exec(select(User).where(User.username == matricula)).first()
        if not user:
            user = User(
                username=matricula,
                password=get_password_hash(matricula),
                role="student",
                full_name=nombre
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            
        # 2. Student Profile
        student = session.exec(select(Student).where(Student.matricula == matricula)).first()
        
        # Resolve Group ID
        gid = get_or_create_group(session, grade, group_name)

        if student:
            # Update mode? Or skip? Let's update basic info if needed
            if student.user_id != user.id:
                student.user_id = user.id
            
            student.group_id = gid
            
            student.nombre = nombre
            session.add(student)
            results["updated"] += 1
        else:
            student = Student(
                nombre=nombre,
                matricula=matricula,
                group_id=gid,
                tenant_id=1,
                user_id=user.id
            )
            session.add(student)
            results["created"] += 1
            
    session.commit()
    return results

# Courses
@app.post("/courses/", response_model=Course)
def create_course(course: CourseCreate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    new_course = Course(**course.dict())
    session.add(new_course)
    session.commit()
    session.refresh(new_course)
    return new_course

@app.get("/courses/")
def read_courses(teacher_id: Optional[int] = None, session: Session = Depends(get_session)):
    statement = select(Course, User).join(User, Course.teacher_id == User.id, isouter=True)
    if teacher_id:
        statement = statement.where(Course.teacher_id == teacher_id)
    
    results = session.exec(statement).all()
    
    response = []
    for course, teacher in results:
        course_data = course.dict()
        course_data["profesor_nombre"] = teacher.full_name if teacher else "Sin Asignar"
        response.append(course_data)
    

    return response

@app.delete("/courses/{course_id}")
def delete_course(course_id: int, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Cascade: Criteria, Enrollments (and grades)
    # 1. Rules
    criteria = session.exec(select(EvaluationCriteria).where(EvaluationCriteria.course_id == course_id)).all()
    for c in criteria: 
        # Grades linked to criteria? Yes, but grades linked to Enrollment too.
        # Check integrity.
        session.delete(c)
        
    # 2. Enrollments
    enrollments = session.exec(select(Enrollment).where(Enrollment.course_id == course_id)).all()
    for e in enrollments:
        grades = session.exec(select(Grade).where(Grade.enrollment_id == e.id)).all()
        for g in grades: session.delete(g)
        session.delete(e)
        
    session.delete(course)
    session.commit()
    return {"status": "success", "message": "Course deleted"}

class CourseUpdate(BaseModel):
    nombre: Optional[str] = None
    periodo: Optional[str] = None
    teacher_id: Optional[int] = None

@app.put("/courses/{course_id}")
def update_course(course_id: int, update: CourseUpdate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if update.nombre: course.nombre = update.nombre
    if update.periodo: course.periodo = update.periodo
    if update.teacher_id: course.teacher_id = update.teacher_id
    
    session.add(course)
    session.commit()
    session.refresh(course)
    return course

# Course Operations: Enrollment & Rules
@app.post("/courses/{course_id}/enroll")
def enroll_student(course_id: int, request: EnrollRequest, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    course = validate_course_access(course_id, teacher, session)
    
    # Normalize input
    matricula = request.matricula.strip().upper()
    nombre = request.nombre.strip()

    # 1. Check/Create User for Student
    user = session.exec(select(User).where(User.username == matricula)).first()
    if not user:
        user = User(
            username=matricula,
            password=get_password_hash(matricula), # Temporary password
            role="student",
            full_name=nombre
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    
    # 2. Check/Create Student Profile
    student = session.exec(select(Student).where(Student.matricula == matricula)).first()
    if not student:
        student = Student(
            nombre=nombre, 
            matricula=matricula, 
            tenant_id=course.tenant_id,
            user_id=user.id
        )
        session.add(student)
        session.commit()
        session.refresh(student)
    
    # 3. Create Enrollment
    # Check if already enrolled
    existing_enrollment = session.exec(select(Enrollment).where(
        Enrollment.course_id == course_id, 
        Enrollment.student_id == student.id
    )).first()

    if not existing_enrollment:
        enrollment = Enrollment(course_id=course_id, student_id=student.id)
        session.add(enrollment)
        session.commit()
        session.refresh(enrollment)
        enroll_id = enrollment.id
    else:
        enroll_id = existing_enrollment.id
    

    
    student_dict = {
        "id": student.id,
        "nombre": student.nombre,
        "matricula": student.matricula,
        "group_id": student.group_id
    }
    return {"status": "success", "enrollment_id": enroll_id, "student": student_dict, "user_created": user.id}

@app.delete("/courses/{course_id}/enrollments/{student_id}")
def delete_enrollment(course_id: int, student_id: int, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    validate_course_access(course_id, teacher, session)
    
    enrollment = session.exec(select(Enrollment).where(
        Enrollment.course_id == course_id,
        Enrollment.student_id == student_id
    )).first()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Delete associated grades first
    grades = session.exec(select(Grade).where(Grade.enrollment_id == enrollment.id)).all()
    for g in grades:
        session.delete(g)
        
    session.delete(enrollment)
    session.delete(enrollment)
    session.commit()
    return {"status": "success", "message": "Student removed from course"}

@app.post("/courses/{course_id}/criteria")
def create_criterion(course_id: int, criterion: CriteriaCreate, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    # Validate course
    course = validate_course_access(course_id, teacher, session)
        
    # Check total weight for period
    existing = session.exec(select(EvaluationCriteria).where(
        EvaluationCriteria.course_id == course_id,
        EvaluationCriteria.period_id == criterion.period_id
    )).all()
    
    current_weight = sum(e.weight_percentage for e in existing)
    if current_weight + criterion.weight_percentage > 100:
        raise HTTPException(status_code=400, detail=f"Total weight checks failed. Current: {current_weight}%, New: {criterion.weight_percentage}%")
        
    new_criterion = EvaluationCriteria(
        course_id=course_id,
        period_id=criterion.period_id,
        name=criterion.name,
        weight_percentage=criterion.weight_percentage
    )
    session.add(new_criterion)
    session.commit()
    session.refresh(new_criterion)
    return new_criterion

@app.post("/courses/{course_id}/periods/{period_id}/criteria")
def set_period_criteria(course_id: int, period_id: int, criteria: List[CriteriaCreate], session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    validate_course_access(course_id, teacher, session)
    # 1. Clear existing criteria for this course AND period
    existing = session.exec(select(EvaluationCriteria).where(
        EvaluationCriteria.course_id == course_id,
        EvaluationCriteria.period_id == period_id
    )).all()
    
    for e in existing:
        session.delete(e)
    
    # 2. Validate total weight
    total_weight = sum(c.weight_percentage for c in criteria)
    if abs(total_weight - 100) > 0.01: 
        raise HTTPException(status_code=400, detail=f"Total weight for this period must be 100% (Got {total_weight}%)")
        
    new_items = [EvaluationCriteria(course_id=course_id, **c.dict()) for c in criteria]
    session.add_all(new_items)
    session.commit()
    new_items = [EvaluationCriteria(course_id=course_id, **c.dict()) for c in criteria]
    session.add_all(new_items)
    session.commit()
    return {"status": "success", "criteria": new_items}

class CriteriaUpdate(BaseModel):
    name: Optional[str] = None
    weight_percentage: Optional[float] = None

@app.put("/criteria/{criteria_id}")
def update_criterion(criteria_id: int, update: CriteriaUpdate, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    criterion = session.get(EvaluationCriteria, criteria_id)
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found")
    
    # Validate course access
    # We need to fetch course to check teacher
    course = session.get(Course, criterion.course_id)
    if not course: raise HTTPException(status_code=404, detail="Course linked to criteria not found")
    
    if teacher.role != "admin" and course.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if update.name: criterion.name = update.name
    
    if update.weight_percentage is not None:
        # Validate total weight constraint
        # Get all OTHER criteria in same period
        others = session.exec(select(EvaluationCriteria).where(
            EvaluationCriteria.course_id == criterion.course_id,
            EvaluationCriteria.period_id == criterion.period_id,
            EvaluationCriteria.id != criteria_id
        )).all()
        
        current_total = sum(c.weight_percentage for c in others)
        if current_total + update.weight_percentage > 100:
             raise HTTPException(status_code=400, detail=f"Total weight exceeds 100% (Current others: {current_total}%)")
             
        criterion.weight_percentage = update.weight_percentage
        
    session.add(criterion)
    session.commit()
    session.refresh(criterion)
    return criterion

@app.delete("/criteria/{criteria_id}")
def delete_criterion(criteria_id: int, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    criterion = session.get(EvaluationCriteria, criteria_id)
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found")

    course = session.get(Course, criterion.course_id)
    if teacher.role != "admin" and (not course or course.teacher_id != teacher.id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    session.delete(criterion)
    session.commit()
    return {"status": "success"}

@app.get("/courses/{course_id}/criteria")
def get_course_criteria(course_id: int, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    # Validate access
    # Allow read if teacher is assigned OR admin
    # What if student? Student needs to see criteria too? Usually yes.
    # For now require teacher or admin.
    
    # Optimization: Check if teacher or admin
    if teacher.role != "admin":
         course = session.get(Course, course_id)
         if not course or course.teacher_id != teacher.id:
             raise HTTPException(status_code=403, detail="Not authorized")

    criteria = session.exec(select(EvaluationCriteria).where(EvaluationCriteria.course_id == course_id)).all()
    return criteria

# --- Course Reporting ---
@app.get("/courses/{course_id}/export")
def export_course_grades(course_id: int, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    course = validate_course_access(course_id, teacher, session)
    
    # Fetch data
    students = session.exec(select(Student).join(Enrollment, Student.id == Enrollment.student_id).where(Enrollment.course_id == course_id)).all()
    periods = session.exec(select(Period)).all()
    
    # Prepare CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header: Name, Matricula, [Period 1], [Period 2]..., Final
    header = ["Nombre", "Matricula"] + [p.name for p in periods] + ["Calificación Final"]
    writer.writerow(header)
    
    for s in students:
        enrollment = session.exec(select(Enrollment).where(Enrollment.student_id == s.id, Enrollment.course_id == course_id)).first()
        if not enrollment: continue
        
        row = [s.nombre, s.matricula]
        for p in periods:
            score = calculate_period_grade(enrollment.id, p.id, course_id, session)
            row.append(score)
            
        final = calculate_final_grade(enrollment.id, session)
        row.append(final)
        
        writer.writerow(row)
        
    output.seek(0)
    # Add BOM for Excel UTF-8 compatibility
    return StreamingResponse(
        iter([codecs.BOM_UTF8 + output.getvalue().encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=calificaciones_{course.nombre}.csv"}
    )

# --- Grade Reporting Helpers ---
def calculate_student_grades(student_id: int, session: Session):
    """
    Returns a list of course performance for a given student, broken down by Period.
    """
    enrollments = session.exec(select(Enrollment).where(Enrollment.student_id == student_id)).all()
    report = []
    periods = session.exec(select(Period)).all()

    for enrollment in enrollments:
        course = session.get(Course, enrollment.course_id)
        if not course: continue

        teacher = session.get(User, course.teacher_id)
        teacher_name = teacher.full_name if teacher else "Sin Asignar"

        final_grade = calculate_final_grade(enrollment.id, session)
        details = []
        
        for p in periods:
            p_score = calculate_period_grade(enrollment.id, p.id, course.id, session)
            details.append({
                "period": p.name,
                "weight": int(p.weight * 100),
                "score": p_score
            })
        
        report.append({
            "course_name": course.nombre,
            "teacher": teacher_name,
            "final_average": final_grade,
            "details": details
        })
    return report

from fastapi import Header

@app.get("/me/grades")
def get_my_grades(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if current_user.role != 'student':
        raise HTTPException(status_code=403, detail="User is not a student")
        
    # Match User -> Student via matricula == username
    # Now we rely on the token, not the X-User-Id header. IDOR FIXED.
    student = session.exec(select(Student).where(Student.matricula == current_user.username)).first()
    if not student:
        return [] # No academic record yet

    return calculate_student_grades(student.id, session)

    return calculate_student_grades(student.id, session)

def get_or_create_group_by_grade_name(session: Session, grade_name: str, tenant_id: int = 1) -> int:
    """
    Helper to find or create an AcademicGrade and a default Group 'A'
    given a grade name (e.g. '1° Semestre').
    Returns the group_id.
    """
    # 1. Find or Create Academic Grade
    ag = session.exec(select(AcademicGrade).where(AcademicGrade.name == grade_name, AcademicGrade.tenant_id == tenant_id)).first()
    if not ag:
        ag = AcademicGrade(name=grade_name, tenant_id=tenant_id)
        session.add(ag)
        session.commit()
        session.refresh(ag)
    
    # 2. Find or Create Default Group 'A'
    group = session.exec(select(Group).where(Group.name == "A", Group.academic_grade_id == ag.id)).first()
    if not group:
        group = Group(name="A", academic_grade_id=ag.id)
        session.add(group)
        session.commit()
        session.refresh(group)
        
    return group.id

def get_or_create_group(session: Session, grade_name: str, group_name: str, tenant_id: int = 1) -> int:
    # 1. Academic Grade
    ag = session.exec(select(AcademicGrade).where(AcademicGrade.name == grade_name, AcademicGrade.tenant_id == tenant_id)).first()
    if not ag:
        ag = AcademicGrade(name=grade_name, tenant_id=tenant_id)
        session.add(ag)
        session.commit()
        session.refresh(ag)
    
    # 2. Group
    if not group_name: group_name = "A"
    
    group = session.exec(select(Group).where(Group.name == group_name, Group.academic_grade_id == ag.id)).first()
    if not group:
        group = Group(name=group_name, academic_grade_id=ag.id)
        session.add(group)
        session.commit()
        session.refresh(group)
        
    return group.id

@app.get("/students/{student_id}/full-report")
def get_student_full_report(student_id: int, session: Session = Depends(get_session)):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    return calculate_student_grades(student_id, session)

@app.get("/students/{student_id}/report_card.pdf")
def get_student_report_card_pdf(student_id: int, session: Session = Depends(get_session)):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    report_data = calculate_student_grades(student_id, session)
    
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, height - 50, "BOLETA DE CALIFICACIONES")
    
    p.setFont("Helvetica", 12)
    p.drawString(50, height - 80, f"Alumno: {student.nombre}")
    p.drawString(50, height - 100, f"Matrícula: {student.matricula}")
    
    # Resolve Grade/Group
    grade_str = "Sin Grado"
    if student.group:
        # Assuming eager load or lazy load works. If not, might need session.refresh or manual query.
        # But SQLModel relationships usually lazy load if creating session.
        # Check if group has academic_grade loaded
        g_name = student.group.name
        ag_name = student.group.academic_grade.name if student.group.academic_grade else "?"
        grade_str = f"{ag_name} - Grupo {g_name}"
        
    p.drawString(50, height - 120, f"Grado: {grade_str}")
    
    p.line(50, height - 130, width - 50, height - 130)
    
    y = height - 160
    
    for course in report_data:
        # Simple check without infinite loop risk
        if y < 100:
            p.showPage()
            y = height - 50
            p.setFont("Helvetica", 12) # Reset font if needed
            
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, y, f"Materia: {course['course_name']}")
        p.setFont("Helvetica", 10)
        p.drawString(300, y, f"Docente: {course['teacher']}")
        p.drawString(500, y, f"Final: {course['final_average']}")
        
        y -= 20
        p.setFont("Helvetica", 9)
        for detail in course['details']:
            p.drawString(70, y, f"- {detail['period']} ({detail['weight']}%): {detail['score']}")
            y -= 15
            
        y -= 20 # Spacing between courses
        
    p.save()
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=reporte_{student.matricula}.pdf"})

# Gradebook & Batch Updates
@app.get("/courses/{course_id}/gradebook")
def get_gradebook(course_id: int, period_id: Optional[int] = None, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    course = validate_course_access(course_id, teacher, session)
        
    query = select(EvaluationCriteria).where(EvaluationCriteria.course_id == course_id)
    if period_id:
        query = query.where(EvaluationCriteria.period_id == period_id)
    criteria_list = session.exec(query).all()
    
    results = session.exec(select(Student, Enrollment).join(Enrollment, Enrollment.student_id == Student.id).where(Enrollment.course_id == course_id)).all()
    
    students_data = []
    enrollment_map = {}
    enrollment_ids = []

    for student, enrollment in results:
        students_data.append({
            "id": student.id,
            "nombre": student.nombre,
            "matricula": student.matricula,
            "enrollment_id": enrollment.id
        })
        enrollment_map[student.id] = enrollment.id
        enrollment_ids.append(enrollment.id)

    grades_map = {}
    final_grades = {}

    if enrollment_ids:
        # Fetch all grades for these enrollments
        grades = session.exec(select(Grade).where(Grade.enrollment_id.in_(enrollment_ids))).all()
        enrollment_to_student = {v: k for k, v in enrollment_map.items()}

        for g in grades:
            s_id = enrollment_to_student.get(g.enrollment_id)
            if s_id:
                if s_id not in grades_map: grades_map[s_id] = {}
                grades_map[s_id][g.criteria_id] = g.score
            
        for s_id in enrollment_map.keys():
            student_grades = grades_map.get(s_id, {})
            if period_id:
                weighted_sum = 0
                for crit in criteria_list:
                    score = student_grades.get(crit.id, 0)
                    weighted_sum += score * (crit.weight_percentage / 100.0)
                final_grades[s_id] = round(weighted_sum, 2)
            else:
                final_grades[s_id] = calculate_final_grade(enrollment_map[s_id], session)

    return {
        "students": students_data,
        "criteria": criteria_list,
        "grades": grades_map,
        "final_grades": final_grades
    }

@app.post("/grades/batch")
def update_batch_grades(request: BatchGradesRequest, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    for item in request.updates:
        statement = select(Grade).where(Grade.enrollment_id == item.enrollment_id, Grade.criteria_id == item.criteria_id)
        existing = session.exec(statement).first()
        if existing: existing.score = item.score
        else: session.add(Grade(enrollment_id=item.enrollment_id, criteria_id=item.criteria_id, score=item.score))
    session.commit()
    return {"status": "success"}

@app.get("/courses/{course_id}/criteria", response_model=List[EvaluationCriteria])
def get_course_criteria(course_id: int, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    validate_course_access(course_id, teacher, session)
    return session.exec(select(EvaluationCriteria).where(EvaluationCriteria.course_id == course_id)).all()

@app.post("/grading/period-setup") # Placeholder to avoid duplicate URL error if I missed one? 
# Actually, I will just remove the duplicate functions.

# ... (Previous code was create_criteria_single at 844) ...
# I am removing lines 844-851 in the previous view. 


class CriteriaUpdate(BaseModel):
    name: Optional[str] = None
    weight_percentage: Optional[float] = None

@app.put("/criteria/{criteria_id}", response_model=EvaluationCriteria)
def update_criteria(criteria_id: int, update: CriteriaUpdate, session: Session = Depends(get_session), teacher: User = Depends(require_teacher)):
    criteria = session.get(EvaluationCriteria, criteria_id)
    if not criteria:
        raise HTTPException(status_code=404, detail="Criteria not found")
    
    # Ownership Check
    validate_course_access(criteria.course_id, teacher, session)
    
    # Validation logic
    if update.weight_percentage is not None:
        # Check total for the period, excluding self
        existing = session.exec(select(EvaluationCriteria).where(
            EvaluationCriteria.course_id == criteria.course_id,
            EvaluationCriteria.period_id == criteria.period_id,
            EvaluationCriteria.id != criteria_id
        )).all()
        
        current_weight = sum(e.weight_percentage for e in existing)
        if current_weight + update.weight_percentage > 100:
             raise HTTPException(status_code=400, detail=f"Total weight exceeds 100% (Current: {current_weight}%, New: {update.weight_percentage}%)")
        
        criteria.weight_percentage = update.weight_percentage

    if update.name is not None:
        criteria.name = update.name
    
    session.add(criteria)
    session.commit()
    session.refresh(criteria)
    return criteria
