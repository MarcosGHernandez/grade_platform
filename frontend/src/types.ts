export interface Tenant {
    id: number;
    nombre_escuela: string;
}

export interface Period {
    id: number;
    name: string;
    weight: number;
    is_active: boolean;
    is_locked: boolean;
}

export interface Group {
    id: number;
    name: string;
    academic_grade_id: number;
    grade_name?: string; // Helper for display
}

export interface Course {
    id: number;
    tenant_id: number;
    teacher_id: number;
    nombre: string;
    profesor_nombre?: string;
    periodo?: string;
}

export interface Student {
    student_id: number;
    nombre: string;
    matricula: string;
    enrollment_id?: number;
    calificacion_final: number | null;
    group_name?: string; // Display helper
}

export interface EvaluationCriteria {
    id: number;
    course_id?: number;
    period_id: number;
    name: string;
    weight_percentage: number;
}
