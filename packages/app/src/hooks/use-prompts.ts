/**
 * usePrompts — Fetch registered prompts from /api/prompts.
 * useRoles   — Fetch available roles from /api/roles.
 *
 * Each hook fetches on mount and returns the list with a loading flag
 * and an error state.
 *
 * Usage:
 *   const { prompts, loading, error } = usePrompts();
 *   const { roles, loading, error } = useRoles();
 */

import { useState, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Prompt entry returned by GET /api/prompts */
export interface ApiPrompt {
  id: string;
  name: string;
  description?: string;
  /** The prompt template text, may contain {{variable}} placeholders */
  template: string;
  /** Variable names extracted or declared for this template */
  variables?: string[];
}

/** Role entry returned by GET /api/roles */
export interface ApiRole {
  id: string;
  name: string;
  description?: string;
  /** System prompt text associated with this role */
  systemPrompt?: string;
}

export interface UsePromptsResult {
  /** List of prompts fetched from the server. Empty until loaded. */
  prompts: ApiPrompt[];
  /** True while the fetch is in-flight. */
  loading: boolean;
  /** Non-null if the fetch failed. */
  error: string | null;
}

export interface UseRolesResult {
  /** List of roles fetched from the server. Empty until loaded. */
  roles: ApiRole[];
  /** True while the fetch is in-flight. */
  loading: boolean;
  /** Non-null if the fetch failed. */
  error: string | null;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

const PROMPTS_API_URL = '/api/prompts';
const ROLES_API_URL = '/api/roles';

export function usePrompts(): UsePromptsResult {
  const [prompts, setPrompts] = useState<ApiPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(PROMPTS_API_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch prompts: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<ApiPrompt[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setPrompts(Array.isArray(data) ? data : []);
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

  return { prompts, loading, error };
}

export function useRoles(): UseRolesResult {
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(ROLES_API_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch roles: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<ApiRole[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setRoles(Array.isArray(data) ? data : []);
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

  return { roles, loading, error };
}
