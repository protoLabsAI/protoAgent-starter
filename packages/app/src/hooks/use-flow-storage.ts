/**
 * useFlowStorage — Server-backed flow persistence hook.
 *
 * Replaces localStorage flow persistence with REST API calls:
 *   GET    /api/flows          — list all saved flows
 *   POST   /api/flows          — create a new flow
 *   PUT    /api/flows/:id      — update (save) an existing flow
 *   DELETE /api/flows/:id      — delete a flow
 *
 * Auto-save debounces 2 s after the last nodes/edges change.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../components/flow-builder/nodes.js';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape returned by the server for each flow. */
export interface ApiFlow {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    [key: string]: unknown;
  };
}

export interface UseFlowStorageResult {
  /** All flows fetched from the server. */
  flows: ApiFlow[];
  /** True while the flow list is being fetched. */
  loadingList: boolean;
  /** ID of the currently active flow (null = unsaved). */
  currentFlowId: string | null;
  /** Name of the currently active flow. */
  currentFlowName: string;
  /** Non-null when the last API call failed. */
  error: string | null;
  /** Save the current canvas to the server (PUT or POST). */
  saveFlow: (nodes: Node<FlowNodeData>[], edges: Edge[], name?: string) => Promise<void>;
  /** Schedule an auto-save with 2s debounce. */
  scheduleAutoSave: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  /** Load a flow from the server and apply it to the canvas. */
  loadFlow: (id: string) => Promise<{ nodes: Node<FlowNodeData>[]; edges: Edge[] } | null>;
  /** Create a brand-new empty flow on the server. */
  newFlow: (name: string) => Promise<ApiFlow | null>;
  /** Delete a flow from the server. */
  deleteFlow: (id: string) => Promise<void>;
  /** Refresh the flow list from the server. */
  refreshFlows: () => Promise<void>;
  /** Status badge text ('idle' | 'saving' | 'saved' | 'error'). */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = '/api/flows';
const AUTO_SAVE_DELAY_MS = 2000;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFlowStorage(): UseFlowStorageResult {
  const [flows, setFlows] = useState<ApiFlow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [currentFlowName, setCurrentFlowName] = useState('Untitled Flow');
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Auto-save timer ref
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to the latest nodes/edges for auto-save closure
  const pendingAutoSave = useRef<{
    nodes: Node<FlowNodeData>[];
    edges: Edge[];
  } | null>(null);

  // ── Fetch flow list ──────────────────────────────────────────────────────
  const refreshFlows = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error(`Failed to list flows: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiFlow[];
      setFlows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    void refreshFlows();
  }, [refreshFlows]);

  // ── Save (PUT or POST) ────────────────────────────────────────────────────
  const saveFlow = useCallback(
    async (nodes: Node<FlowNodeData>[], edges: Edge[], name?: string) => {
      setSaveStatus('saving');
      setError(null);
      const flowName = name ?? currentFlowName;
      try {
        let res: Response;
        if (currentFlowId) {
          // Update existing flow
          res = await fetch(`${API_BASE}/${currentFlowId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: flowName, nodes, edges }),
          });
        } else {
          // Create new flow
          res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: flowName, nodes, edges }),
          });
        }

        if (!res.ok) {
          throw new Error(`Save failed: ${res.status} ${res.statusText}`);
        }

        const saved = (await res.json()) as ApiFlow;
        setCurrentFlowId(saved.id);
        setCurrentFlowName(saved.name);

        // Update flows list
        setFlows((prev) => {
          const idx = prev.findIndex((f) => f.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [...prev, saved];
        });

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1800);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    },
    [currentFlowId, currentFlowName],
  );

  // ── Schedule auto-save ────────────────────────────────────────────────────
  const scheduleAutoSave = useCallback(
    (nodes: Node<FlowNodeData>[], edges: Edge[]) => {
      pendingAutoSave.current = { nodes, edges };
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        if (pendingAutoSave.current) {
          void saveFlow(pendingAutoSave.current.nodes, pendingAutoSave.current.edges);
          pendingAutoSave.current = null;
        }
      }, AUTO_SAVE_DELAY_MS);
    },
    [saveFlow],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  // ── Load a flow ───────────────────────────────────────────────────────────
  const loadFlow = useCallback(
    async (id: string): Promise<{ nodes: Node<FlowNodeData>[]; edges: Edge[] } | null> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${id}`);
        if (!res.ok) {
          throw new Error(`Failed to load flow: ${res.status} ${res.statusText}`);
        }
        const flow = (await res.json()) as ApiFlow;
        setCurrentFlowId(flow.id);
        setCurrentFlowName(flow.name);
        return {
          nodes: flow.nodes as Node<FlowNodeData>[],
          edges: flow.edges as Edge[],
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [],
  );

  // ── New flow ──────────────────────────────────────────────────────────────
  const newFlow = useCallback(async (name: string): Promise<ApiFlow | null> => {
    setError(null);
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nodes: [], edges: [] }),
      });
      if (!res.ok) {
        throw new Error(`Failed to create flow: ${res.status} ${res.statusText}`);
      }
      const flow = (await res.json()) as ApiFlow;
      setCurrentFlowId(flow.id);
      setCurrentFlowName(flow.name);
      setFlows((prev) => [...prev, flow]);
      return flow;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  // ── Delete flow ───────────────────────────────────────────────────────────
  const deleteFlow = useCallback(
    async (id: string): Promise<void> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          throw new Error(`Failed to delete flow: ${res.status} ${res.statusText}`);
        }
        setFlows((prev) => prev.filter((f) => f.id !== id));
        // If we just deleted the active flow, clear current
        if (currentFlowId === id) {
          setCurrentFlowId(null);
          setCurrentFlowName('Untitled Flow');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [currentFlowId],
  );

  return {
    flows,
    loadingList,
    currentFlowId,
    currentFlowName,
    error,
    saveFlow,
    scheduleAutoSave,
    loadFlow,
    newFlow,
    deleteFlow,
    refreshFlows,
    saveStatus,
  };
}
