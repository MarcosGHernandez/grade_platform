import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Plus, Trash2, PieChart, Settings2 } from 'lucide-react';
import { EvaluationCriteria } from '../types';

interface EvaluationConfigProps {
    courseId: number;
    periodId: number;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export function EvaluationConfig({ courseId, periodId, isOpen, onClose, onUpdate }: EvaluationConfigProps) {
    const [criteria, setCriteria] = useState<EvaluationCriteria[]>([]);
    const [newName, setNewName] = useState('');
    const [newWeight, setNewWeight] = useState('');
    const [loading, setLoading] = useState(false);

    // Edit State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editWeight, setEditWeight] = useState('');

    useEffect(() => {
        if (isOpen && periodId) {
            fetchCriteria();
        }
    }, [isOpen, courseId, periodId]);

    const fetchCriteria = async () => {
        try {
            // Fetch ALL criteria, filter in frontend or backend?
            // Backend endpoint returns all. We filter here.
            // Ideally backend should filter. But to save time:
            const response = await axios.get(`http://localhost:8000/courses/${courseId}/criteria`);
            const filtered = response.data.filter((c: any) => c.period_id === periodId);
            setCriteria(filtered);
        } catch (error) {
            console.error("Error fetching criteria", error);
        }
    };

    const handleAddCriteria = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName || !newWeight) return;

        const weight = parseFloat(newWeight);
        const currentTotal = criteria.reduce((sum, c) => sum + c.weight_percentage, 0);

        if (currentTotal + weight > 100) {
            toast.error(`Error: La suma superaría el 100% (Actual: ${currentTotal}%)`);
            return;
        }

        setLoading(true);
        try {
            await axios.post(`http://localhost:8000/courses/${courseId}/criteria`, {
                name: newName,
                weight_percentage: weight,
                period_id: periodId
            });
            toast.success('Criterio agregado');
            setNewName('');
            setNewWeight('');
            fetchCriteria();
            onUpdate();
        } catch (error) {
            toast.error('Error al agregar criterio');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este criterio? Se borrarán las calificaciones asociadas.')) return;
        try {
            await axios.delete(`http://localhost:8000/criteria/${id}`);
            toast.success('Criterio eliminado');
            fetchCriteria();
            onUpdate();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const startEditing = (c: EvaluationCriteria) => {
        setEditingId(c.id);
        setEditName(c.name);
        setEditWeight(c.weight_percentage.toString());
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
        setEditWeight('');
    };

    const saveEdit = async () => {
        if (!editingId || !editName || !editWeight) return;

        // Validate total weight excluding current item
        const weight = parseFloat(editWeight);
        const otherCriteriaTotal = criteria
            .filter(c => c.id !== editingId)
            .reduce((sum, c) => sum + c.weight_percentage, 0);

        if (otherCriteriaTotal + weight > 100) {
            toast.error(`Error: La suma superaría el 100%`);
            return;
        }

        try {
            await axios.put(`http://localhost:8000/criteria/${editingId}`, {
                name: editName,
                weight_percentage: weight
            });
            toast.success('Criterio actualizado');
            setEditingId(null);
            fetchCriteria();
            onUpdate();
        } catch (error) {
            toast.error('Error al actualizar');
        }
    };

    const totalWeight = criteria.reduce((sum, c) => sum + c.weight_percentage, 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex items-center space-x-2">
                        <PieChart className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Configurar Evaluación</h3>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* List existing */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Criterios Actuales</h4>
                        {criteria.length === 0 ? (
                            <p className="text-sm text-zinc-400 italic">No hay criterios definidos.</p>
                        ) : (
                            <ul className="space-y-2">
                                {criteria.map((c) => (
                                    <li key={c.id} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg border border-zinc-100 dark:border-zinc-700 group">
                                        {editingId === c.id ? (
                                            <div className="flex items-center space-x-2 w-full">
                                                <input
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    className="flex-1 px-2 py-1 bg-white dark:bg-zinc-900 rounded border border-zinc-300 dark:border-zinc-600 text-sm"
                                                    autoFocus
                                                />
                                                <input
                                                    type="number"
                                                    value={editWeight}
                                                    onChange={e => setEditWeight(e.target.value)}
                                                    className="w-16 px-2 py-1 bg-white dark:bg-zinc-900 rounded border border-zinc-300 dark:border-zinc-600 text-sm"
                                                />
                                                <button onClick={saveEdit} className="text-green-500 hover:text-green-600"><Plus className="w-4 h-4 rotate-45 transform" /></button>
                                                <button onClick={cancelEditing} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-zinc-700 dark:text-zinc-200 font-medium">{c.name}</span>
                                                    <span className="text-xs text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">{c.weight_percentage}%</span>
                                                </div>
                                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEditing(c)} className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors" title="Editar">
                                                        <Settings2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(c.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors" title="Eliminar">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-sm font-medium">Total Acumulado:</span>
                            <span className={`font-bold ${totalWeight === 100 ? 'text-green-500' : totalWeight > 100 ? 'text-red-500' : 'text-amber-500'}`}>
                                {totalWeight}%
                            </span>
                        </div>
                    </div>

                    {/* Add New */}
                    <form onSubmit={handleAddCriteria} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Nuevo Criterio</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                    placeholder="Nombre (ej. Proyecto)"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Porcentaje</label>
                                <input
                                    type="number"
                                    value={newWeight}
                                    onChange={e => setNewWeight(e.target.value)}
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                    placeholder="%"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading || totalWeight >= 100}
                            className="w-full flex justify-center items-center space-x-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 font-medium text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Agregar Criterio</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
