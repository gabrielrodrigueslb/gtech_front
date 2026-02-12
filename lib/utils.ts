import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
  // --- FORMATAÇÃO DE TELEFONE (XX) XXXXX-XXXX ---
export const formatPhoneNumber = (value: string) => {
  if (!value) return '';
  
  // Remove tudo que não é dígito
  const numbers = value.replace(/\D/g, '');
  const limit = numbers.slice(0, 11); // Limita a 11 números

  if (limit.length <= 2) return limit;
  if (limit.length <= 6) return `(${limit.slice(0, 2)}) ${limit.slice(2)}`;
  if (limit.length <= 10) return `(${limit.slice(0, 2)}) ${limit.slice(2, 6)}-${limit.slice(6)}`;
  
  // Formato celular 9 dígitos
  return `(${limit.slice(0, 2)}) ${limit.slice(2, 7)}-${limit.slice(7)}`;
};

// --- FORMATAÇÃO DE MOEDA (Para exibição no Input) ---
// Transforma 1500.5 em "R$ 1.500,50"
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
};

// --- PARSER DE MOEDA (Para salvar no Estado) ---
// Transforma "R$ 1.500,50" (string) em 1500.50 (number)
// Funciona pegando apenas os números e dividindo por 100
export const parseCurrency = (value: string): number => {
  const numbers = value.replace(/\D/g, '');
  return Number(numbers) / 100;
};
