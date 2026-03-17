/**
 * useTools — Fetch registered tools from the /api/tools endpoint.
 *
 * Fetches on mount and returns the list of tools with their schemas,
 * a loading flag, and an error state.
 *
 * Usage:
 *   const { tools, loading, error } = useTools();
 */

import { useState, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Tool entry returned by GET /api/tools */
export interface ApiTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  metadata?: {
    category?: string;
    tags?: string[];
    version?: string;
  } | null;
}

export interface UseToolsResult {
  /** List of tools fetched from the server. Empty until loaded. */
  tools: ApiTool[];
  /** True while the fetch is in-flight. */
  loading: boolean;
  /** Non-null if the fetch failed. */
  error: string | null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const TOOLS_API_URL = '/api/tools';

export function useTools(): UseToolsResult {
  const [tools, setTools] = useState<ApiTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(TOOLS_API_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch tools: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<ApiTool[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setTools(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { tools, loading, error };
}
