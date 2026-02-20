import requests
import sys

BASE_URL = "http://localhost:8002"

def check_endpoint(name, method, url, auth=None, json_data=None):
    headers = {"Authorization": f"Bearer {auth}"} if auth else {}
    try:
        if method == "GET":
            resp = requests.get(f"{BASE_URL}{url}", headers=headers)
        elif method == "POST":
            resp = requests.post(f"{BASE_URL}{url}", json=json_data, headers=headers)
        
        status = "✅" if resp.status_code < 400 else "❌"
        print(f"{status} {name}: {resp.status_code}")
        if resp.status_code >= 400:
            print(f"   Error: {resp.text}")
        return resp
    except Exception as e:
        print(f"❌ {name}: Exception {e}")
        return None

def diagnostic():
    print("--- System Diagnostics ---")
    
    # 1. Login
    login_resp = requests.post(f"{BASE_URL}/login", data={"username": "admin", "password": "admin123"})
    if login_resp.status_code != 200:
        print("CRITICAL: Admin login failed")
        return
    token = login_resp.json()["access_token"]
    print("✅ Admin Login")

    # 2. Relational Schema
    check_endpoint("Fetch Periods", "GET", "/periods/", token)
    check_endpoint("Fetch Academic Grades", "GET", "/academic-grades/", token)
    check_endpoint("Fetch Groups", "GET", "/groups/", token)
    
    # 3. Teacher Area
    teacher_resp = requests.post(f"{BASE_URL}/login", data={"username": "profesor", "password": "123"})
    if teacher_resp.status_code == 200:
        t_token = teacher_resp.json()["access_token"]
        print("✅ Teacher Login")
        courses = check_endpoint("Fetch Teacher Courses", "GET", "/courses/", t_token).json()
        if courses:
             c_id = courses[0]["id"]
             check_endpoint(f"Fetch Criteria for Course {c_id}", "GET", f"/courses/{c_id}/criteria", t_token)
             check_endpoint(f"Fetch Gradebook for Course {c_id}", "GET", f"/courses/{c_id}/gradebook", t_token)
    else:
        print("❌ Teacher Login failed")

if __name__ == "__main__":
    diagnostic()
