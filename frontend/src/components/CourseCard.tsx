import React from 'react';
import { Course } from '../types';
import { BookOpen, User } from 'lucide-react';

interface CourseCardProps {
    course: Course;
    onClick: (course: Course) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, onClick }) => {
    return (
        <div
            onClick={() => onClick(course)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer group"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
                    <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
            </div>

            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                {course.nombre}
            </h3>

            <div className="flex items-center text-zinc-500 dark:text-zinc-400 text-sm">
                <User className="w-4 h-4 mr-2" />
                <span>{course.profesor_nombre}</span>
            </div>
        </div>
    );
};
