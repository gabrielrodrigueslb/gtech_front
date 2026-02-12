'use client';

import { getPipelines } from '@/lib/pipeline';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type FunnelStage = {
  id: string;
  name: string;
  color?: string;
};

export type Funnel = {
  id: string;
  name: string;
  stages: FunnelStage[];
};

type FunnelContextType = {
  funnels: Funnel[];
  activeFunnelId: string;
  activeFunnel: Funnel | null;
  isLoadingFunnels: boolean;
  setActiveFunnelId: (id: string) => void;
  refreshFunnels: () => Promise<void>;
  addFunnel: (funnel: Funnel) => void;
  updateFunnel: (id: string, data: Partial<Funnel>) => void;
  deleteFunnel: (id: string) => void;
};

const FunnelContext = createContext<FunnelContextType | undefined>(undefined);

const normalizeFunnels = (raw: any[]): Funnel[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((pipeline) => ({
    id: String(pipeline.id),
    name: pipeline.name || '',
    stages: Array.isArray(pipeline.stages) ? pipeline.stages : [],
  }));
};

export function FunnelProvider({ children }: { children: ReactNode }) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [activeFunnelId, setActiveFunnelId] = useState('');
  const [isLoadingFunnels, setIsLoadingFunnels] = useState(false);
  const hasLoadedRef = useRef(false);

  const syncActiveFunnelId = useCallback((nextFunnels: Funnel[]) => {
    setActiveFunnelId((current) => {
      if (current && nextFunnels.some((f) => f.id === current)) return current;
      return nextFunnels[0]?.id || '';
    });
  }, []);

  const refreshFunnels = useCallback(async () => {
    setIsLoadingFunnels(true);
    try {
      const data = await getPipelines();
      const nextFunnels = normalizeFunnels(data);
      setFunnels(nextFunnels);
      syncActiveFunnelId(nextFunnels);
    } catch (error) {
      console.error('Erro ao carregar funis:', error);
    } finally {
      setIsLoadingFunnels(false);
    }
  }, [syncActiveFunnelId]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    refreshFunnels();
  }, [refreshFunnels]);

  const addFunnel = useCallback((funnel: Funnel) => {
    setFunnels((prev) => {
      if (prev.some((f) => f.id === funnel.id)) return prev;
      const next = [...prev, funnel];
      if (!activeFunnelId) {
        setActiveFunnelId(funnel.id);
      }
      return next;
    });
  }, [activeFunnelId]);

  const updateFunnel = useCallback((id: string, data: Partial<Funnel>) => {
    setFunnels((prev) => prev.map((f) => (f.id === id ? { ...f, ...data } : f)));
  }, []);

  const deleteFunnel = useCallback((id: string) => {
    setFunnels((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (activeFunnelId === id) {
        setActiveFunnelId(next[0]?.id || '');
      }
      return next;
    });
  }, [activeFunnelId]);

  const activeFunnel = useMemo(
    () => funnels.find((f) => f.id === activeFunnelId) || null,
    [funnels, activeFunnelId],
  );

  return (
    <FunnelContext.Provider
      value={{
        funnels,
        activeFunnelId,
        activeFunnel,
        isLoadingFunnels,
        setActiveFunnelId,
        refreshFunnels,
        addFunnel,
        updateFunnel,
        deleteFunnel,
      }}
    >
      {children}
    </FunnelContext.Provider>
  );
}

export function useFunnel() {
  const context = useContext(FunnelContext);
  if (!context) throw new Error('useFunnel must be used within FunnelProvider');
  return context;
}
