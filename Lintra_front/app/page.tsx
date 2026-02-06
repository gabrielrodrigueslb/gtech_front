'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, loginRequest } from '@/lib/auth';

export const dynamic = "force-dynamic";
export const revalidate = 0;


export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Preencha todos os campos.');
      setLoading(false);
      return;
    }

    try {
      await loginRequest({ email, password });
      router.push('/main/dashboard');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro inesperado ao tentar logar.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex w-screen bg-black/70">
      <div className="flex items-center justify-center relative overflow-hidden w-full flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.35),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(036,72,220,0.25),transparent_55%)]" />

        <form
          onSubmit={handleLogin}
          className="z-10 relative p-10 rounded-2xl shadow-xl flex flex-col gap-5 w-[90%] max-w-md
bg-gray-600/10 backdrop-blur-xl border border-gray-400/10 text-white"
        >
          <img
            src="/logo_dark.png"
            className="w-40 z-20 pb-6 self-center"
            alt=""
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-200">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-400/10 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="seu@email.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-200">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-400/10 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Senha"
            />
          </div>

          {error && (
            <div className="bg-red-100 text-red-600 p-2 rounded text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="text-center text-sm text-gray-200">
            Esqueceu a senha?{' '}
            <span className="text-primary cursor-pointer hover:underline">
              Recuperar acesso
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
