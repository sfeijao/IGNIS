import { useState, useEffect } from 'react';

interface APIState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseSafeAPIOptions {
  skip?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

/**
 * Hook seguro para chamadas de API que previne loading infinito
 * @param fetcher - Função que retorna Promise com os dados
 * @param dependencies - Array de dependências que disparam refetch
 * @param options - Opções adicionais
 */
export function useSafeAPI<T = any>(
  fetcher: () => Promise<T>,
  dependencies: any[] = [],
  options: UseSafeAPIOptions = {}
): APIState<T> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<APIState<T>>({
    data: null,
    loading: !options.skip,
    error: null
  });

  const fetchData = async () => {
    if (options.skip) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await fetcher();
      setState({ data: result, loading: false, error: null });
      options.onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      console.error('[useSafeAPI] Error:', errorMessage, err);
      setState({ data: null, loading: false, error: errorMessage });
      options.onError?.(errorMessage);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return {
    ...state,
    refetch: fetchData
  };
}

/**
 * Wrapper seguro para chamadas fetch que sempre retorna JSON válido
 */
export async function safeFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      ...options
    });

    // Sempre tenta fazer parse do JSON
    let data: any;
    try {
      data = await res.json();
    } catch (parseError) {
      // Se não conseguir parsear, assume erro de servidor
      throw new Error(`Server returned invalid JSON (${res.status})`);
    }

    // Se a resposta não for OK, lança erro com mensagem do servidor
    if (!res.ok) {
      throw new Error(data?.error || data?.message || `Request failed with status ${res.status}`);
    }

    // Se o servidor retornou { success: false }, trata como erro
    if (data && typeof data === 'object' && data.success === false) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  } catch (err) {
    // Re-lança erros de fetch (network errors, etc)
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Network error - please check your connection');
    }
    throw err;
  }
}

/**
 * Hook para loading state com timeout automático (previne loading infinito)
 */
export function useLoadingTimeout(initialLoading: boolean = false, timeoutMs: number = 30000) {
  const [loading, setLoading] = useState(initialLoading);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(false);
      setTimedOut(true);
      console.warn('[useLoadingTimeout] Loading timeout exceeded');
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [loading, timeoutMs]);

  return { loading, timedOut, setLoading };
}
