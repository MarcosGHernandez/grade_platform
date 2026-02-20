import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
    ArrowLeft, Users, FileSpreadsheet, Settings2, Plus,
    Trash2, Save
} from 'lucide-react';
import { EvaluationConfig } from './EvaluationConfig';

interface Student {
    id: number;
    nombre: string;
    matricula: string;
    enrollment_id: number;
}

interface Period {
    id: number;
    name: string;
    weight: number;
}

interface GradeTableProps {
    courseId: number;
    onBack: () => void;
}

interface AllStudent {
    id: number;
    nombre: string;
    matricula: string;
}

export const GradeTable: React.FC<GradeTableProps> = ({ courseId, onBack }) => {
    const [activeTab, setActiveTab] = useState<'grades' | 'students'>('grades');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

    // Grade Editing State
    const [editGrades, setEditGrades] = useState<{ [key: string]: string }>({});
    const [savingGrades, setSavingGrades] = useState(false);

    // Enrollment Modal
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [enrollName, setEnrollName] = useState('');
    const [enrollMatricula, setEnrollMatricula] = useState('');

    // Rules Modal
    const [showRulesModal, setShowRulesModal] = useState(false);

    // Student Lookup for Enrollment
    const [allStudents, setAllStudents] = useState<AllStudent[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');

    // Student History Modal State
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [studentReport, setStudentReport] = useState<any[]>([]);
    const [loadingReport, setLoadingReport] = useState(false);

    useEffect(() => {
        fetchPeriods();
        fetchAllStudents();
    }, [courseId]);

    useEffect(() => {
        if (courseId) {
            fetchGradebook();
        }
    }, [courseId, selectedPeriodId]);

    const fetchPeriods = async () => {
        try {
            const resp = await axios.get('http://localhost:8000/periods/');
            setPeriods(resp.data);
            if (resp.data.length > 0 && !selectedPeriodId) {
                setSelectedPeriodId(resp.data[0].id);
            }
        } catch (e) {
            console.error("Error fetching periods", e);
        }
    };

    const fetchAllStudents = async () => {
        try {
            const resp = await axios.get('http://localhost:8000/students/');
            setAllStudents(resp.data);
        } catch (e) {
            console.error("Error fetching students", e);
        }
    };

    const fetchGradebook = async () => {
        try {
            const url = selectedPeriodId
                ? `http://localhost:8000/courses/${courseId}/gradebook?period_id=${selectedPeriodId}`
                : `http://localhost:8000/courses/${courseId}/gradebook`;

            const resp = await axios.get(url);
            setData(resp.data);

            const initial: { [key: string]: string } = {};
            if (resp.data.grades) {
                Object.entries(resp.data.grades).forEach(([studentId, criteriaMap]: [string, any]) => {
                    Object.entries(criteriaMap).forEach(([critId, score]: [string, any]) => {
                        initial[`${studentId}-${critId}`] = score.toString();
                    });
                });
            }
            setEditGrades(initial);
        } catch (e) {
            console.error("Gradebook fetch error:", e);
            // Don't show error toast on 404 (empty), just clear data
            if (axios.isAxiosError(e) && e.response?.status === 404) {
                setData(null);
            } else {
                toast.error('Error al cargar libreta de notas');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchStudentReport = async (student: Student) => {
        setSelectedStudent(student);
        setLoadingReport(true);
        try {
            const resp = await axios.get(`http://localhost:8000/students/${student.id}/full-report`);
            setStudentReport(resp.data);
        } catch (e) {
            toast.error('Error al cargar historial del alumno');
        } finally {
            setLoadingReport(false);
        }
    };

    const handleGradeChange = (studentId: number, critId: number, value: string) => {
        setEditGrades(prev => ({ ...prev, [`${studentId}-${critId}`]: value }));
    };

    const saveBatchGrades = async () => {
        setSavingGrades(true);
        const updates = Object.entries(editGrades).map(([key, value]) => {
            const [studentId, critId] = key.split('-');
            const enrollment = data.students.find((s: any) => s.id === parseInt(studentId));
            return {
                enrollment_id: enrollment.enrollment_id,
                criteria_id: parseInt(critId),
                score: parseFloat(value) || 0
            };
        });

        try {
            await axios.post('http://localhost:8000/grades/batch', { updates });
            toast.success('Calificaciones guardadas');
            fetchGradebook();
        } catch (e) {
            toast.error('Error al guardar');
        } finally {
            setSavingGrades(false);
        }
    };

    const handleEnroll = async (e: React.FormEvent) => {
        e.preventDefault();

        // Find existing student or use manual entry (though we prefer selection now)
        let name = enrollName;
        let matricula = enrollMatricula;

        if (selectedStudentId && selectedStudentId !== 'manual') {
            const selected = allStudents.find(s => s.id === parseInt(selectedStudentId));
            if (selected) {
                name = selected.nombre;
                matricula = selected.matricula;
            }
        }

        if (!name || !matricula) {
            toast.error('Selecciona un alumno o ingresa los datos');
            return;
        }

        try {
            await axios.post(`http://localhost:8000/courses/${courseId}/enroll`, {
                nombre: name,
                matricula: matricula
            });
            toast.success('Alumno inscrito');
            setShowEnrollModal(false);
            setEnrollName('');
            setEnrollMatricula('');
            setSelectedStudentId('');
            fetchGradebook();
        } catch (e) {
            toast.error('Error al inscribir');
        }
    };



    const handleDeleteStudent = async (studentId: number) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este alumno del curso? Se perderán sus calificaciones.')) return;

        try {
            await axios.delete(`http://localhost:8000/courses/${courseId}/enrollments/${studentId}`);
            toast.success('Alumno eliminado del curso');
            fetchGradebook();
        } catch (e) {
            toast.error('Error al eliminar alumno');
        }
    };

    const calculateColumnAverage = (critId: number) => {
        if (!data || data.students.length === 0) return 0;
        let sum = 0;
        let count = 0;
        data.students.forEach((s: any) => {
            const val = parseFloat(editGrades[`${s.id}-${critId}`] || '0');
            sum += val;
            count++;
        });
        return (sum / count).toFixed(1);
    };

    const calculateFinalAverage = () => {
        if (!data || data.students.length === 0) return 0;
        let sum = 0;
        Object.values(data.final_grades).forEach((g: any) => sum += g);
        return (sum / data.students.length).toFixed(1);
    };

    const handleExport = async () => {
        try {
            const response = await axios.get(`http://localhost:8000/courses/${courseId}/export`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `calificaciones_${courseId}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            toast.error('Error al descargar');
        }
    };

    if (loading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center space-x-2 text-zinc-500 hover:text-indigo-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Volver</span>
                </button>
                <div className="flex space-x-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center space-x-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 transition-all"
                        title="Descargar Excel"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="text-sm font-medium hidden sm:inline">Excel</span>
                    </button>
                    <button
                        onClick={() => {
                            if (!selectedPeriodId) {
                                toast.error('Selecciona un parcial primero');
                                return;
                            }
                            setShowRulesModal(true);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 transition-all"
                    >
                        <Settings2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Configurar</span>
                    </button>
                    {activeTab === 'grades' && (
                        <button
                            onClick={saveBatchGrades}
                            disabled={savingGrades}
                            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            <span className="text-sm font-medium">{savingGrades ? 'Guardando...' : 'Guardar Todo'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Period Tabs */}
            <div className="flex space-x-1 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg w-max mb-6">
                {periods.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setSelectedPeriodId(p.id)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${selectedPeriodId === p.id
                            ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        {p.name}
                    </button>
                ))}
                <button
                    onClick={() => setSelectedPeriodId(null)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${selectedPeriodId === null
                        ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                >
                    Resumen Final
                </button>
            </div>

            {/* Course Stats / Tabs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 space-y-2">
                    <button
                        onClick={() => setActiveTab('grades')}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'grades' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-100 dark:border-indigo-900/30' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                    >
                        <FileSpreadsheet className="w-5 h-5" />
                        <span className="font-semibold">Sábana de Notas</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('students')}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'students' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-100 dark:border-indigo-900/30' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                    >
                        <Users className="w-5 h-5" />
                        <span className="font-semibold">Alumnos Inscritos</span>
                    </button>
                </div>

                <div className="md:col-span-3">
                    {activeTab === 'grades' ? (
                        !data ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-12 text-center">
                                <div className="text-zinc-400 mb-4">
                                    <FileSpreadsheet className="w-12 h-12 mx-auto" />
                                </div>
                                <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">Sin Datos</h3>
                                <p className="text-zinc-500 mb-6">No hay criterios de evaluación configurados o no hay alumnos inscritos.</p>
                                <button
                                    onClick={() => {
                                        if (!selectedPeriodId) {
                                            toast.error('Selecciona un parcial primero');
                                            return;
                                        }
                                        setShowRulesModal(true);
                                    }}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Configurar Evaluación
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                            <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest min-w-[200px]">Alumno</th>
                                            {data.criteria.map((c: any) => (
                                                <th key={c.id} className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">
                                                    {c.name}
                                                    <div className="text-[10px] text-zinc-500 mt-1 font-normal">({c.weight_percentage}%)</div>
                                                </th>
                                            ))}
                                            <th className="px-6 py-4 text-xs font-bold text-indigo-400 uppercase tracking-widest text-center bg-indigo-50/50 dark:bg-indigo-950/20">Final</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {data.students.map((s: any) => (
                                            <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <button onClick={() => fetchStudentReport(s)} className="text-left group">
                                                        <div className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors">{s.nombre}</div>
                                                        <div className="text-xs text-zinc-400 font-mono group-hover:underline decoration-zinc-300">#{s.matricula}</div>
                                                    </button>
                                                </td>
                                                {data.criteria.map((c: any) => (
                                                    <td key={c.id} className="px-4 py-4 text-center">
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            max="10"
                                                            value={editGrades[`${s.id}-${c.id}`] || ''}
                                                            onChange={e => handleGradeChange(s.id, c.id, e.target.value)}
                                                            className="w-16 h-10 text-center bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-center bg-indigo-50/30 dark:bg-indigo-950/10">
                                                    <span className={`text-lg font-bold ${data.final_grades[s.id] < 6 ? 'text-red-500' : 'text-green-500'}`}>
                                                        {data.final_grades[s.id]}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {data.students.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-zinc-100 dark:bg-zinc-950/50 border-t-2 border-zinc-200 dark:border-zinc-800 font-bold">
                                                <td className="px-6 py-4 text-zinc-500 text-xs uppercase tracking-widest">Promedio Grupo</td>
                                                {data.criteria.map((c: any) => (
                                                    <td key={c.id} className="px-4 py-4 text-center text-zinc-600 dark:text-zinc-400">
                                                        {calculateColumnAverage(c.id)}
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-center bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600">
                                                    {calculateFinalAverage()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                                {data.students.length === 0 && (
                                    <div className="p-12 text-center text-zinc-500">Sin alumnos inscritos</div>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button onClick={() => setShowEnrollModal(true)} className="flex items-center space-x-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-bold transition-transform active:scale-95">
                                    <Plus className="w-4 h-4" />
                                    <span>Inscribir Alumno</span>
                                </button>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden text-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-zinc-500">Nombre</th>
                                            <th className="px-6 py-4 font-semibold text-zinc-500">Matrícula</th>
                                            <th className="px-6 py-4 font-semibold text-zinc-500 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {data?.students ? data.students.map((s: any) => (
                                            <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors group">
                                                <td className="px-6 py-4 font-medium">
                                                    <button onClick={() => fetchStudentReport(s)} className="hover:underline hover:text-indigo-600 transition-colors">
                                                        {s.nombre}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-zinc-400">{s.matricula}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => handleDeleteStudent(s.id)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">No hay alumnos.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {selectedStudent && (
                <Modal title={`Historial Académico: ${selectedStudent.nombre}`} onClose={() => setSelectedStudent(null)}>
                    {loadingReport ? (
                        <div className="p-8 text-center text-zinc-500">Cargando historial...</div>
                    ) : (
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                            {studentReport.map((rep, idx) => (
                                <div key={idx} className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-zinc-900 dark:text-white">{rep.course_name}</h4>
                                            <span className="text-xs text-zinc-500">{rep.teacher}</span>
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${rep.final_average < 6 ? 'bg-red-100 text-red-600' : rep.final_average < 8 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                            Prom: {rep.final_average}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {rep.details.map((d: any, i: number) => (
                                            <div key={i} className="flex justify-between text-xs text-zinc-500">
                                                <span>{d.criteria}</span>
                                                <span className="font-mono">{d.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {studentReport.length === 0 && <p className="text-center text-zinc-500 italic">No hay otros cursos registrados.</p>}
                        </div>
                    )}
                </Modal>
            )}

            {showEnrollModal && (
                <Modal title="Inscribir Alumno" onClose={() => setShowEnrollModal(false)}>
                    <form onSubmit={handleEnroll} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Buscar Alumno Existente</label>
                            <select
                                value={selectedStudentId}
                                onChange={e => {
                                    setSelectedStudentId(e.target.value);
                                    if (e.target.value !== 'manual' && e.target.value !== '') {
                                        const s = allStudents.find(x => x.id === parseInt(e.target.value));
                                        if (s) {
                                            setEnrollName(s.nombre);
                                            setEnrollMatricula(s.matricula);
                                        }
                                    }
                                }}
                                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                            >
                                <option value="">-- Seleccionar de la lista --</option>
                                <option value="manual">Persona Nueva / No está en lista</option>
                                {allStudents
                                    .filter(s => !data?.students.some((enrolled: any) => enrolled.id === s.id))
                                    .map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.matricula} - {s.nombre}
                                        </option>
                                    ))
                                }
                            </select>
                        </div>

                        {(selectedStudentId === 'manual' || selectedStudentId === '') && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nombre Completo</label>
                                    <input placeholder="Ej. Juan Pérez" required value={enrollName} onChange={e => setEnrollName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Matrícula / ID</label>
                                    <input placeholder="Ej. ABC123" required value={enrollMatricula} onChange={e => setEnrollMatricula(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                                </div>
                            </div>
                        )}

                        {selectedStudentId !== '' && selectedStudentId !== 'manual' && (
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                                <p className="text-sm text-indigo-700 dark:text-indigo-300">
                                    Se inscribirá a <span className="font-bold">{enrollName}</span> con matrícula <span className="font-mono">{enrollMatricula}</span>.
                                </p>
                            </div>
                        )}

                        <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors">
                            {selectedStudentId && selectedStudentId !== 'manual' ? 'Confirmar Inscripción' : 'Inscribir y Crear Registro'}
                        </button>
                    </form>
                </Modal>
            )}

            {showRulesModal && selectedPeriodId && (
                <EvaluationConfig
                    courseId={courseId}
                    periodId={selectedPeriodId}
                    isOpen={showRulesModal}
                    onClose={() => setShowRulesModal(false)}
                    onUpdate={fetchGradebook}
                />
            )}
        </div>
    );
};

function Modal({ children, onClose, title }: { children: React.ReactNode, onClose: () => void, title: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-8 border border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl">×</button>
                </div>
                {children}
            </div>
        </div>
    );
}
