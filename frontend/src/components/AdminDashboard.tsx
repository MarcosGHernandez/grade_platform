import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, BookOpen, User as UserIcon, Users, GraduationCap, Trash2, Edit, Eye, KeyRound, FileUp, FileText, Settings2 } from 'lucide-react';

interface Course {
    id: number;
    nombre: string;
    periodo: string;
    teacher_id: number;
    profesor_nombre: string;
}

interface Teacher {
    id: number;
    username: string;
    full_name: string;
    role: string;
    courses: Course[];
}

interface Student {
    id: number;
    nombre: string;
    matricula: string;
    grade_level?: string;
}

interface Period {
    id: number;
    name: string;
    weight: number;
}

export function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<'courses' | 'teachers' | 'students' | 'periods'>('courses');
    const [courses, setCourses] = useState<Course[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Modals
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [showTeacherModal, setShowTeacherModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);

    // Student Report Modal
    const [showStudentReport, setShowStudentReport] = useState(false);
    const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
    const [studentReportData, setStudentReportData] = useState<any[]>([]);

    // Filters
    const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');

    // Course Form State
    const [newCourseName, setNewCourseName] = useState('');
    const [newCoursePeriod, setNewCoursePeriod] = useState('2024-1');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

    // Teacher Form State
    const [tFullName, setTFullName] = useState('');
    const [tUsername, setTUsername] = useState('');
    const [tPassword, setTPassword] = useState('');

    // Student Form State
    const [showStudentModal, setShowStudentModal] = useState(false);

    // Password Reset State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordUserId, setPasswordUserId] = useState<number | null>(null);
    const [newPassword, setNewPassword] = useState('');

    // CSV Import
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            toast.error('Solo se permiten archivos CSV');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        setLoading(true);

        try {
            const res = await axios.post('http://localhost:8000/students/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' } // Browser sets boundary automatically with FormData
            });
            toast.success(`Importación: ${res.data.created} nuevos, ${res.data.updated} actualizados.`);
            if (res.data.errors.length > 0) {
                toast.warning(`Omitidos ${res.data.errors.length} registros con errores.`);
                console.warn(res.data.errors);
            }
            fetchData();
        } catch (error) {
            toast.error('Error al importar archivo');
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchPeriods = async () => {
        try {
            const resp = await axios.get('http://localhost:8000/periods/');
            setPeriods(resp.data);
        } catch (error) {
            console.error('Error loading periods');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [coursesRes, teachersRes, studentsRes] = await Promise.all([
                axios.get('http://localhost:8000/courses/'),
                axios.get('http://localhost:8000/users/teachers'),
                axios.get('http://localhost:8000/students/')
            ]);
            setCourses(coursesRes.data);
            setTeachers(teachersRes.data);
            setStudents(studentsRes.data);
        } catch (error) {
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (type: 'users' | 'courses' | 'students', id: number) => {
        if (!confirm('¿Estás seguro de eliminar este elemento? Esta acción eliminará datos relacionados.')) return;
        try {
            await axios.delete(`http://localhost:8000/${type}/${id}`);
            toast.success('Eliminado correctamente');
            fetchData();
        } catch (e) {
            toast.error('Error al eliminar');
        }
    };

    const handleCreateOrUpdateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingCourse) {
                // Update
                await axios.put(`http://localhost:8000/courses/${editingCourse.id}`, {
                    nombre: newCourseName,
                    periodo: newCoursePeriod,
                    teacher_id: parseInt(selectedTeacherId)
                });
                toast.success('Curso actualizado');
            } else {
                // Create
                await axios.post('http://localhost:8000/courses/', {
                    tenant_id: 1,
                    nombre: newCourseName,
                    teacher_id: parseInt(selectedTeacherId),
                    periodo: newCoursePeriod
                });
                toast.success('Curso creado');
            }
            setShowCourseModal(false);
            setEditingCourse(null);
            resetCourseForm();
            fetchData();
        } catch (error) {
            toast.error('Error al guardar curso');
        } finally {
            setSubmitting(false);
        }
    };

    const resetCourseForm = () => {
        setNewCourseName('');
        setNewCoursePeriod('2024-1');
        setSelectedTeacherId('');
        setEditingCourse(null);
    };

    const openEditCourse = (c: Course) => {
        setEditingCourse(c);
        setNewCourseName(c.nombre);
        setNewCoursePeriod(c.periodo || '2024-1');
        setSelectedTeacherId(c.teacher_id.toString());
        setShowCourseModal(true);
    };

    const handleCreateTeacher = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post('http://localhost:8000/users/', {
                full_name: tFullName,
                username: tUsername,
                password: tPassword,
                role: 'teacher'
            });
            toast.success('Docente registrado');
            setShowTeacherModal(false);
            setTFullName('');
            setTUsername('');
            setTPassword('');
            fetchData();
        } catch (error) {
            toast.error('Error al registrar docente');
        } finally {
            setSubmitting(false);
        }
    };



    // Create Student State
    const [sName, setSName] = useState('');
    const [sMatricula, setSMatricula] = useState('');
    const [sGrade, setSGrade] = useState('1° Semestre');
    const [sGroup, setSGroup] = useState('A');

    const handleCreateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post('http://localhost:8000/students/', {
                nombre: sName,
                matricula: sMatricula,
                grade: sGrade,
                group: sGroup
            });
            toast.success('Alumno registrado');
            setShowStudentModal(false);
            setSName('');
            setSMatricula('');
            setSGrade('1° Semestre');
            setSGroup('A');
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al registrar alumno');
        } finally {
            setSubmitting(false);
        }
    };

    // Edit Student State
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [editSName, setEditSName] = useState('');
    const [editSMatricula, setEditSMatricula] = useState('');
    const [editSGrade, setEditSGrade] = useState('');
    const [editSGroup, setEditSGroup] = useState('');

    const openEditStudent = (student: Student) => {
        setEditingStudent(student);
        setEditSName(student.nombre);
        setEditSMatricula(student.matricula);

        let g = "1° Semestre";
        let gr = "A";

        // Parse from "1° Semestre - Grupo A" or similar if virtual field is used
        // But better to relay on backend if possible. 
        // For now, parse string.
        if (student.grade_level) {
            const parts = student.grade_level.split(" - Grupo ");
            if (parts.length >= 1) g = parts[0];
            if (parts.length >= 2) gr = parts[1];
        }

        setEditSGrade(g);
        setEditSGroup(gr);
        setShowStudentModal(true);
    };

    const handleUpdateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStudent) return;
        setSubmitting(true);
        try {
            await axios.patch(`http://localhost:8000/students/${editingStudent.id}`, {
                grade: editSGrade,
                group: editSGroup
            });
            toast.success('Alumno actualizado');
            setEditingStudent(null);
            setShowStudentModal(false);
            fetchData();
        } catch (error) {
            toast.error('Error al actualizar alumno');
        } finally {
            setSubmitting(false);
        }
    };

    const viewStudentReport = async (student: Student) => {
        setSelectedStudentForReport(student);
        setShowStudentReport(true);
        try {
            const res = await axios.get(`http://localhost:8000/students/${student.id}/full-report`);
            setStudentReportData(res.data);
        } catch (e) {
            toast.error('Error cargando reporte');
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordUserId) return;
        setSubmitting(true);
        try {
            await axios.put(`http://localhost:8000/users/${passwordUserId}/password`, {
                new_password: newPassword
            });
            toast.success('Contraseña actualizada');
            setShowPasswordModal(false);
            setPasswordUserId(null);
            setNewPassword('');
        } catch (error) {
            toast.error('Error al actualizar contraseña');
        } finally {
            setSubmitting(false);
        }
    };

    const openPasswordModal = (userId: number) => {
        setPasswordUserId(userId);
        setNewPassword('');
        setShowPasswordModal(true);
    };

    const handleDownloadReport = (student: Student) => {
        window.open(`http://localhost:8000/students/${student.id}/report_card.pdf`, '_blank');
    };


    return (
        <div className="space-y-8">
            <div className="flex space-x-1 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('courses')}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'courses' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                >
                    <GraduationCap className="w-4 h-4" />
                    <span>Cursos</span>
                </button>
                <button
                    onClick={() => setActiveTab('teachers')}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'teachers' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                >
                    <Users className="w-4 h-4" />
                    <span>Docentes</span>
                </button>
                <button
                    onClick={() => setActiveTab('students')}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'students' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                >
                    <UserIcon className="w-4 h-4" />
                    <span>Alumnos</span>
                </button>
                <button
                    onClick={() => { setActiveTab('periods'); fetchPeriods(); }}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'periods' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                >
                    <Settings2 className="w-4 h-4" />
                    <span>Periodos</span>
                </button>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'courses' ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Cursos Ofertados</h2>
                                <p className="text-zinc-500 text-sm">Administra la oferta académica y asignación de docentes.</p>
                            </div>
                            <button
                                onClick={() => setShowCourseModal(true)}
                                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="font-semibold text-sm">Alta de Curso</span>
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 text-xs uppercase tracking-wider">Materia</th>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 text-xs uppercase tracking-wider">Profesor Titular</th>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 text-xs uppercase tracking-wider">Periodo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {courses.map(c => (
                                            <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-600">
                                                            <BookOpen className="w-5 h-5" />
                                                        </div>
                                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{c.nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                                                    <div className="flex items-center space-x-2">
                                                        <UserIcon className="w-4 h-4 text-zinc-400" />
                                                        <span>{c.profesor_nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium text-zinc-500">
                                                        {c.periodo}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openEditCourse(c)}
                                                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-indigo-600 transition-colors"
                                                            title="Editar Periodo/Info"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete('courses', c.id)}
                                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-zinc-400 hover:text-red-600 transition-colors"
                                                            title="Eliminar Curso"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'teachers' ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Plantilla Docente</h2>
                                <p className="text-zinc-500 text-sm">Gestiona los accesos y perfiles de los catedráticos.</p>
                            </div>
                            <button
                                onClick={() => setShowTeacherModal(true)}
                                className="flex items-center space-x-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl transition-all shadow-lg"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="font-semibold text-sm">Alta de Docente</span>
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden text-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider">Docente</th>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider">Carga Académica</th>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {teachers.map(t => (
                                            <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-zinc-900 dark:text-white">{t.full_name}</div>
                                                    <div className="text-xs text-zinc-400">Usuario: {t.username}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        {t.courses && t.courses.length > 0 ? (
                                                            t.courses.map(c => (
                                                                <div key={c.id} className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-xs font-medium text-indigo-700 dark:text-indigo-300 mr-2 border border-indigo-100 dark:border-indigo-800">
                                                                    {c.nombre} <span className="opacity-50 ml-1">({c.periodo})</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="text-zinc-400 text-xs italic">Sin cursos asignados</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => openPasswordModal(t.id)}
                                                        className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg text-zinc-300 hover:text-orange-500 transition-colors"
                                                        title="Cambiar Contraseña"
                                                    >
                                                        <KeyRound className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete('users', t.id)}
                                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-zinc-300 hover:text-red-600 transition-colors"
                                                        title="Eliminar Docente"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Relación de Alumnos</h2>
                                <p className="text-zinc-500 text-sm">Listado general de alumnos inscritos en el sistema.</p>
                            </div>
                            <select
                                value={selectedGradeFilter}
                                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                                className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">Todos los Grados</option>
                                {[...new Set(students.map(s => s.grade_level || 'Sin Grado'))].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => setShowStudentModal(true)}
                                className="ml-2 flex items-center space-x-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl transition-all shadow-lg"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="font-semibold text-sm">Registrar Alumno</span>
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                                accept=".csv"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="ml-2 flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg"
                                title="Formato CSV: nombre, matricula, grade_level"
                            >
                                <FileUp className="w-5 h-5" />
                                <span className="font-semibold text-sm">Importar CSV</span>
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden text-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider">Nombre del Alumno</th>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider">Grado</th>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider">Matrícula</th>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {students
                                            .filter(s => selectedGradeFilter === 'all' || (s.grade_level || 'Sin Grado') === selectedGradeFilter)
                                            .map(s => (
                                                <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors group">
                                                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">{s.nombre}</td>
                                                    <td className="px-6 py-4 text-zinc-500">
                                                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">{s.grade_level || '—'}</span>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-zinc-500">{s.matricula}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end space-x-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    // We need the User ID here. 
                                                                    // Assuming Student model has user_id now.
                                                                    // If not populated in frontend type yet, we might need to cast or update interface.
                                                                    // For now let's hope it's there or we need to add it to Student interface.
                                                                    if ((s as any).user_id) openPasswordModal((s as any).user_id);
                                                                    else toast.error("Este alumno no tiene usuario enlazado");
                                                                }}
                                                                className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg text-zinc-300 hover:text-orange-500 transition-colors"
                                                                title="Cambiar Contraseña"
                                                            >
                                                                <KeyRound className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => viewStudentReport(s)}
                                                                className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-zinc-300 hover:text-indigo-600 transition-colors"
                                                                title="Ver Calificaciones"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => openEditStudent(s)}
                                                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-zinc-300 hover:text-blue-600 transition-colors"
                                                                title="Editar Grado"
                                                            >
                                                                <Settings2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadReport(s)}
                                                                className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-zinc-300 hover:text-rose-600 transition-colors"
                                                                title="Descargar Boleta PDF"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete('students', s.id)}
                                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-zinc-300 hover:text-red-600 transition-colors"
                                                                title="Eliminar Alumno"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {
                showCourseModal && (
                    <Modal onClose={() => setShowCourseModal(false)} title={editingCourse ? "Editar Materia" : "Nueva Materia"}>
                        <form onSubmit={handleCreateOrUpdateCourse} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nombre</label>
                                <input
                                    type="text" required value={newCourseName} onChange={e => setNewCourseName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Ej. Análisis de Algoritmos"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Periodo</label>
                                <input
                                    type="text" required value={newCoursePeriod} onChange={e => setNewCoursePeriod(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Ej. 2024-1"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Docente Asignado</label>
                                <select
                                    required value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">Selecciona un docente...</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                                </select>
                            </div>
                            <button
                                type="submit" disabled={submitting}
                                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 disabled:opacity-50"
                            >
                                {submitting ? 'Guardando...' : 'Guardar Curso'}
                            </button>
                        </form>
                    </Modal>
                )
            }

            {
                showTeacherModal && (
                    <Modal onClose={() => setShowTeacherModal(false)} title="Registrar Docente">
                        <form onSubmit={handleCreateTeacher} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nombre Completo</label>
                                <input
                                    type="text" required value={tFullName} onChange={e => setTFullName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Isaac Newton"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Usuario</label>
                                    <input
                                        type="text" required value={tUsername} onChange={e => setTUsername(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Contraseña</label>
                                    <input
                                        type="password" required value={tPassword} onChange={e => setTPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit" disabled={submitting}
                                className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-xl shadow-xl disabled:opacity-50"
                            >
                                {submitting ? 'Registrando...' : 'Finalizar Registro'}
                            </button>
                        </form>
                    </Modal>
                )
            }

            {
                showStudentModal && (
                    <Modal onClose={() => { setShowStudentModal(false); setEditingStudent(null); }} title={editingStudent ? "Editar Alumno" : "Registrar Alumno"}>
                        <form onSubmit={editingStudent ? handleUpdateStudent : handleCreateStudent} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nombre Completo</label>
                                <input
                                    type="text" required
                                    value={editingStudent ? editSName : sName}
                                    onChange={e => editingStudent ? setEditSName(e.target.value) : setSName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                                    placeholder="Nombre del Alumno"
                                    disabled={!!editingStudent}
                                />
                                {editingStudent && <p className="text-xs text-amber-500 mt-1">Solo se puede modificar el grado.</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Matrícula</label>
                                    <input
                                        type="text" required
                                        value={editingStudent ? editSMatricula : sMatricula}
                                        onChange={e => editingStudent ? setEditSMatricula(e.target.value) : setSMatricula(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-50"
                                        placeholder="ALU001"
                                        disabled={!!editingStudent}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Grado</label>
                                    <select
                                        value={editingStudent ? editSGrade : sGrade}
                                        onChange={e => editingStudent ? setEditSGrade(e.target.value) : setSGrade(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="1° Semestre">1° Semestre</option>
                                        <option value="2° Semestre">2° Semestre</option>
                                        <option value="3° Semestre">3° Semestre</option>
                                        <option value="4° Semestre">4° Semestre</option>
                                        <option value="5° Semestre">5° Semestre</option>
                                        <option value="6° Semestre">6° Semestre</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Grupo</label>
                                    <select
                                        value={editingStudent ? editSGroup : sGroup}
                                        onChange={e => editingStudent ? setEditSGroup(e.target.value) : setSGroup(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="D">D</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                type="submit" disabled={submitting}
                                className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-xl shadow-xl disabled:opacity-50"
                            >
                                {submitting ? 'Guardando...' : (editingStudent ? 'Actualizar Grado' : 'Finalizar Registro')}
                            </button>
                        </form>
                    </Modal>
                )
            }

            {
                showStudentReport && selectedStudentForReport && (
                    <Modal onClose={() => setShowStudentReport(false)} title={`Reporte Académico: ${selectedStudentForReport.nombre}`}>
                        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                            {/* Student Details */}
                            <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                <div>
                                    <p className="text-sm text-zinc-500">Matrícula</p>
                                    <p className="font-mono font-medium">{selectedStudentForReport.matricula}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-zinc-500">Grado</p>
                                    <p className="font-medium">{selectedStudentForReport.grade_level || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Report Content */}
                            {studentReportData.length === 0 ? (
                                <div className="text-center py-10 text-zinc-400">
                                    <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                    <p>No hay registros académicos disponibles.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {studentReportData.map((courseReport, idx) => (
                                        <div key={idx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                                            <div className="bg-zinc-50 dark:bg-zinc-950 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4" />
                                                    {courseReport.course_name}
                                                </h4>
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${courseReport.final_average >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    Promedio: {courseReport.final_average}
                                                </span>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="text-xs text-zinc-500 mb-2">
                                                    Docente: <span className="text-zinc-700 dark:text-zinc-300">{courseReport.teacher}</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {courseReport.details.map((det: any, i: number) => (
                                                        <div key={i} className="flex justify-between text-sm border-b border-zinc-100 dark:border-zinc-800 pb-1 last:border-0">
                                                            <span>{det.criteria} <span className="text-zinc-400 text-xs">({det.weight}%)</span></span>
                                                            <span className="font-mono">{det.score}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Modal>
                )
            }

            {
                showPasswordModal && (
                    <Modal onClose={() => setShowPasswordModal(false)} title="Cambiar Contraseña">
                        <form onSubmit={handlePasswordReset} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nueva Contraseña</label>
                                <input
                                    type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Escribe la nueva contraseña..."
                                />
                            </div>
                            <button
                                type="submit" disabled={submitting}
                                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 disabled:opacity-50"
                            >
                                {submitting ? 'Actualizando...' : 'Actualizar Contraseña'}
                            </button>
                        </form>
                    </Modal>
                )
            }
        </div >
    );
}

function Modal({ children, onClose, title }: { children: React.ReactNode, onClose: () => void, title: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-8 scale-in-center border border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}
