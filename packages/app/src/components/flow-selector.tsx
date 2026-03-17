/**
 * FlowSelector — dropdown to pick an active flow for the chat session.
 *
 * Fetches the list of available flows from GET /api/flows and renders a
 * <select> with a "No flow" default option. When the user picks a flow the
 * `onChange` callback is called with the selected flow ID (empty string = none).
 */

import { useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Flow {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
}

interface FlowSelectorProps {
  selectedFlowId: string;
  onChange: (flowId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FlowSelector({ selectedFlowId, onChange }: FlowSelectorProps) {
  const [flows, setFlows] = useState<Flow[]>([]);

  useEffect(() => {
    fetch('/api/flows')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setFlows(data as Flow[]);
        }
      })
      .catch(() => {});
  }, []);

  // Don't render the selector if there are no flows yet — keeps the header
  // uncluttered on first load or when the project has no flows saved.
  if (flows.length === 0) return null;

  return (
    <select
      value={selectedFlowId}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground"
      aria-label="Select flow"
    >
      <option value="">No flow</option>
      {flows.map((flow) => (
        <option key={flow.id} value={flow.id}>
          {flow.name}
        </option>
      ))}
    </select>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useFlowConfig resolves the active flow's system prompt and tool names from
 * the server whenever `flowId` changes.
 *
 * Returns `{ systemPrompt, tools, name }` — all undefined when no flow is
 * selected or the fetch fails.
 */
export interface FlowConfig {
  name: string | undefined;
  systemPrompt: string | undefined;
  tools: string[] | undefined;
}

export function useFlowConfig(flowId: string): FlowConfig {
  const [config, setConfig] = useState<FlowConfig>({
    name: undefined,
    systemPrompt: undefined,
    tools: undefined,
  });

  useEffect(() => {
    if (!flowId) {
      setConfig({ name: undefined, systemPrompt: undefined, tools: undefined });
      return;
    }

    fetch(`/api/flows/${flowId}`)
      .then((r) => r.json())
      .then((flow: unknown) => {
        if (flow && typeof flow === 'object') {
          const f = flow as Record<string, unknown>;
          const meta = (f['metadata'] ?? {}) as Record<string, unknown>;
          setConfig({
            name: typeof f['name'] === 'string' ? f['name'] : undefined,
            systemPrompt:
              typeof meta['systemPrompt'] === 'string' ? meta['systemPrompt'] : undefined,
            tools: Array.isArray(meta['tools'])
              ? (meta['tools'] as string[]).filter((t) => typeof t === 'string')
              : undefined,
          });
        }
      })
      .catch(() => {
        setConfig({ name: undefined, systemPrompt: undefined, tools: undefined });
      });
  }, [flowId]);

  return config;
}
