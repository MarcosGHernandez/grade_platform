import requests
import json

BASE_URL = "http://localhost:8000"

def debug():
    print("--- TEACHERS (GET /users/teachers) ---")
    try:
        teachers = requests.get(f"{BASE_URL}/users/teachers").json()
        for t in teachers:
            print(f"ID: {t['id']}, User: {t['username']}, Name: {t['full_name']}")
    except Exception as e:
        print(f"Error fetching teachers: {e}")

    print("\n--- STUDENTS (GET /students/) ---")
    try:
        students = requests.get(f"{BASE_URL}/students/").json()
        for s in students:
            print(f"ID: {s['id']}, Name: {s['nombre']}, Matricula: {s['matricula']}")
    except Exception as e:
        print(f"Error fetching students: {e}")

    print("\n--- COURSES (GET /courses/) ---")
    try:
        courses = requests.get(f"{BASE_URL}/courses/").json()
        for c in courses:
            print(f"ID: {c['id']}, Name: {c['nombre']}, TeacherID: {c['teacher_id']}, Prof: {c.get('profesor_nombre', 'N/A')}")
    except Exception as e:
        print(f"Error fetching courses: {e}")

if __name__ == "__main__":
    debug()
