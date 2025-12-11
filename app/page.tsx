'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, loginRequest } from '@/lib/auth';

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
  e.preventDefault()

  if (loading) return

  setError('')
  setLoading(true)

  if (!email || !password) {
    setError('Preencha todos os campos.')
    setLoading(false)
    return
  }

  try {
    await loginRequest({email, password})
    router.push('/main')
  } catch (err) {
    if (err instanceof Error) {
      setError(err.message)
    } else {
      setError('Erro inesperado ao tentar logar.')
    }
  } finally {
    setLoading(false)
  }
}



  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* LADO ESQUERDO */}
      <div className="hidden md:flex flex-col items-center justify-center  text-white p-10">
        <h1 className="text-4xl font-bold mb-4">CRM Pro</h1>
        <p className="text-center text-lg max-w-md">
          Gerencie seus clientes, vendas e tarefas em um só lugar de forma
          simples e eficiente.
        </p>
      </div>

      {/* LADO DIREITO */}
      <div className="flex items-center justify-center bg-gray-100">
        <form
          onSubmit={handleLogin}
          className="bg-white p-10 rounded-2xl shadow-xl flex flex-col gap-5 w-[90%] max-w-md text-gray-950"
        >
          <h2 className="text-2xl font-bold text-center text-gray-900">
            Acesse sua conta
          </h2>

          {/* EMAIL */}
          <div className="flex flex-col gap-1 text-gray-950">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="seu@email.com"
            />
          </div>

          {/* SENHA */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Senha"
            />
          </div>

          {/* ERRO */}
          {error && (
            <div className="bg-red-100 text-red-600 p-2 rounded text-sm text-center">
              {error}
            </div>
          )}

          {/* BOTÃO */}
          <button
            type="submit"
            disabled={loading}
            className="bg-amber-500 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          {/* LINK EXTRA */}
          <div className="text-center text-sm text-gray-600">
            Esqueceu a senha?{' '}
            <span className="text-amber-600 cursor-pointer hover:underline">
              Recuperar acesso
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
