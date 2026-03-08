interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'USER';
  };
}

interface loginRequestParams {
  email: string;
  password: string;
}

export interface AuthUserSummary {
  id: string
  name: string
  email: string
  active: boolean
  role?: 'ADMIN' | 'USER'
}

export interface AuthMeUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'USER'
}

let meRequestPromise: Promise<any | null> | null = null;
let meCacheValue: any | null = null;
let meCacheAt = 0;
let hasMeCache = false;
const GET_ME_CACHE_TTL_MS = 15_000;

function resetMeCache() {
  meRequestPromise = null;
  meCacheValue = null;
  meCacheAt = 0;
  hasMeCache = false;
}

export async function loginRequest({
  email,
  password,
}: loginRequestParams): Promise<LoginResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 🔥 OBRIGATÓRIO
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Erro ao logar');
  }

  const data = await res.json();
  resetMeCache();
  return data;
}

export async function getMe(): Promise<AuthMeUser | null> {
  const now = Date.now();
  if (hasMeCache && now - meCacheAt < GET_ME_CACHE_TTL_MS) {
    return meCacheValue;
  }

  if (meRequestPromise) {
    return meRequestPromise;
  }

  meRequestPromise = (async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      credentials: 'include',
    });

    if (!res.ok) {
      meCacheValue = null;
      meCacheAt = Date.now();
      hasMeCache = true;
      return null;
    }

    const data = await res.json();
    meCacheValue = data;
    meCacheAt = Date.now();
    hasMeCache = true;
    return data;
  })().finally(() => {
    meRequestPromise = null;
  });

  return meRequestPromise;
}

export async function getUsers(): Promise<AuthUserSummary[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/users`, {
    credentials: 'include',
  })

  if (!res.ok) {
    throw new Error('Erro ao listar usuarios')
  }

  return await res.json()
}
