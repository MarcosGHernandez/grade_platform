import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BookOpen, User, ChevronDown, ChevronUp, Award } from 'lucide-react';

interface GradeDetail {
    period: string; // Was criteria
    weight: number;
    score: number;
}

interface StudentGradeReport {
    course_name: string;
    teacher: string;
    final_average: number;
    details: GradeDetail[];
}

export function StudentDashboard() {
    const { user } = useAuth();
    const [reports, setReports] = useState<StudentGradeReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) fetchGrades();
    }, [user]);

    const fetchGrades = async () => {
        try {
            const response = await axios.get('http://localhost:8000/me/grades');
            setReports(response.data);
        } catch (error) {
            console.error("Error fetching grades", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="mb-8">
                <h2 className="text-zinc-500 font-medium mb-1 italic">Bienvenido, {user?.full_name}</h2>
                <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-emerald-600">
                    Mis Calificaciones
                </h1>
                <p className="text-zinc-400 mt-2">Consulta tu desempeño académico en tiempo real.</p>
            </div>

            {reports.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                        <BookOpen className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white">Sin registros académicos</h3>
                    <p className="text-zinc-500">Aún no tienes materias con calificaciones registradas.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reports.map((report, idx) => (
                        <ReportCard key={idx} report={report} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ReportCard({ report }: { report: StudentGradeReport }) {
    const [expanded, setExpanded] = useState(false);

    // Semantic Colors
    const getScoreColor = (score: number) => {
        if (score < 6.0) return 'text-red-500 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30';
        if (score < 8.0) return 'text-amber-500 bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30';
        return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30';
    };

    const colorClass = getScoreColor(report.final_average);
    const borderColor = report.final_average < 6 ? 'border-red-200 dark:border-red-900/50' :
        report.final_average < 8 ? 'border-amber-200 dark:border-amber-900/50' :
            'border-emerald-200 dark:border-emerald-900/50';

    return (
        <div
            className={`bg-white dark:bg-zinc-900 rounded-2xl border ${borderColor} overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer select-none`}
            onClick={() => setExpanded(!expanded)}
        >
            {/* Header */}
            <div className="p-6">
                <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white line-clamp-1">{report.course_name}</h3>
                        <div className="flex items-center text-sm text-zinc-500 mt-1">
                            <User className="w-3 h-3 mr-1" />
                            <span className="truncate">{report.teacher}</span>
                        </div>
                    </div>
                    <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl border-2 ${colorClass}`}>
                        <span className="text-xl font-bold">{report.final_average}</span>
                        <span className="text-[10px] uppercase font-bold opacity-70">Nota</span>
                    </div>
                </div>

                {/* Mini Progress Bar for visual impact */}
                <div className="mt-4 h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full ${report.final_average < 6 ? 'bg-red-500' : report.final_average < 8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${(report.final_average / 10) * 100}%` }}
                    />
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="bg-zinc-50/50 dark:bg-zinc-800/20 border-t border-zinc-100 dark:border-zinc-800 p-6 animate-in slide-in-from-top-2">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center">
                        <Award className="w-3 h-3 mr-2" />
                        Desglose de Evaluación
                    </h4>
                    <div className="space-y-3">
                        {report.details.map((detail, i) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                                <span className="text-zinc-600 dark:text-zinc-400">{detail.period} <span className="text-zinc-300 text-xs">({detail.weight}%)</span></span>
                                <span className="font-mono font-medium text-zinc-900 dark:text-white">{detail.score}</span>
                            </div>
                        ))}
                    </div>
                    {report.details.length === 0 && (
                        <p className="text-xs text-zinc-400 italic">No hay detalles disponibles aún.</p>
                    )}
                </div>
            )}

            {/* Footer / Chevron */}
            <div className="bg-zinc-50 dark:bg-zinc-950/50 p-2 flex justify-center border-t border-zinc-100 dark:border-zinc-800/50">
                {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </div>
        </div>
    );
}
