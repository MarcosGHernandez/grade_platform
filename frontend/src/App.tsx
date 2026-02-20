import { useState, useEffect } from 'react';
import { Course } from './types';
import { CourseCard } from './components/CourseCard';
import { GradeTable } from './components/GradeTable';
import { AdminDashboard } from './components/AdminDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import axios from 'axios';
import { School, LogOut } from 'lucide-react';
import { Toaster } from 'sonner';

function Dashboard() {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, [user]);

  const fetchCourses = async () => {
    if (!user) return;

    // Admin sees all (or manages all), Teacher sees only theirs.
    // However, AdminDashboard handles its own fetching. We only fetch here for "Teacher View".
    if (user.role === 'admin') {
      setLoading(false);
      return;
    }

    try {
      // If teacher, filter by their ID
      const url = user.role === 'teacher'
        ? `http://localhost:8000/courses/?teacher_id=${user.id}`
        : `http://localhost:8000/courses/`;

      const response = await axios.get(url);
      setCourses(response.data);
    } catch (error) {
      console.error("Error fetching courses", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCourseClick = async (course: Course) => {
    setSelectedCourse(course);
  };

  const handleBack = () => {
    setSelectedCourse(null);
  };

  // 1. Admin Logic
  if (user?.role === 'admin') {
    return (
      <Layout user={user} logout={logout}>
        <AdminDashboard />
      </Layout>
    );
  }

  // 2. Student View
  if (user?.role === 'student') {
    return (
      <Layout user={user} logout={logout}>
        <StudentDashboard />
      </Layout>
    );
  }

  // 3. Teacher View
  return (
    <Layout user={user} logout={logout}>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : selectedCourse ? (
        // Fix: Pass key to force remount if needed, though ID check is enough
        <GradeTable
          courseId={selectedCourse.id}
          onBack={handleBack}
        />
      ) : (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Mis Cursos Asignados</h2>
          </div>

          {courses.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-500">No tienes cursos asignados.</p>
              <p className="text-xs text-zinc-400 mt-2">Contacta al administrador.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onClick={handleCourseClick}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

// Layout wrapper to reduce duplication
function Layout({ children, user, logout }: { children: React.ReactNode, user: any, logout: () => void }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <School className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              VIKOTECH
            </h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-sm text-zinc-500 flex flex-col items-end">
              <span className="font-semibold text-zinc-900 dark:text-white">{user?.username}</span>
              <span className="text-xs uppercase tracking-wider">{user?.role}</span>
            </div>
            <button
              onClick={logout}
              className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainContent />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

function MainContent() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Dashboard /> : <Login />;
}

export default App;
