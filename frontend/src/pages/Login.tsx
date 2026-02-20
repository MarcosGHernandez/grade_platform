import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { School, Lock, User } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // In a real app, this points to the backend
            // Backend now uses OAuth2PasswordRequestForm, so we must send form data
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await axios.post('http://localhost:8000/login', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            login({
                id: response.data.id,
                username: response.data.username,
                full_name: response.data.full_name,
                role: response.data.role,
                token: response.data.access_token // Map access_token to token
            });
            toast.success(`Bienvenido, ${response.data.username}`);
        } catch (error) {
            console.error(error); // Log error for debugging
            toast.error('Credenciales inválidas');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
            <div className="max-w-md w-full space-y-8 bg-zinc-900 p-8 rounded-2xl border border-zinc-800 shadow-xl">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center">
                        <School className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-white">
                        VIKOTECH
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                        Ingresa a tu cuenta institucional
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="relative">
                            <User className="absolute top-3 left-3 h-5 w-5 text-zinc-500" />
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="appearance-none rounded-none rounded-t-xl relative block w-full px-10 py-3 border border-zinc-700 bg-zinc-950 placeholder-zinc-500 text-zinc-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="Usuario"
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute top-3 left-3 h-5 w-5 text-zinc-500" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none rounded-none rounded-b-xl relative block w-full px-10 py-3 border border-zinc-700 bg-zinc-950 placeholder-zinc-500 text-zinc-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="Contraseña"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
