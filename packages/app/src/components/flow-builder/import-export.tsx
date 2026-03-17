/**
 * import-export.tsx — Import/Export toolbar buttons for the Flow Builder.
 *
 * Exports:
 *   ExportFlowButton  — saves flow to server then downloads .json via /api/flows/:id/export
 *   ImportFlowButton  — opens file picker, validates via /api/flows/import, loads onto canvas
 *   CopyAsJsonButton  — copies the flow graph JSON to clipboard
 */

import { useRef, useState, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from './nodes.js';
import { graphToJson } from './codegen.js';

// ── API response types ────────────────────────────────────────────────────────

interface ExportedFlowMetadata {
  id: string;
  name: string;
  description?: string;
  exportedAt: string;
  version: string;
}

interface ExportedFlow {
  schema: 'flow-export/v1';
  metadata: ExportedFlowMetadata;
  graph: {
    nodes: unknown[];
    edges: unknown[];
  };
  toolRefs: string[];
  promptRefs: string[];
}

export interface ImportWarning {
  type: 'missing_tool' | 'missing_prompt';
  ref: string;
  message: string;
}

interface ImportApiResult {
  flow: {
    id: string;
    name: string;
    graph: {
      nodes: Node<FlowNodeData>[];
      edges: Edge[];
    };
  };
  warnings: ImportWarning[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Collect tool names referenced by tool nodes. */
function extractToolRefs(nodes: Node<FlowNodeData>[]): string[] {
  return nodes
    .filter((n) => n.data.kind === 'tool' && n.data.toolName)
    .map((n) => n.data.toolName as string);
}

/** Collect prompt names referenced by agent nodes. */
function extractPromptRefs(nodes: Node<FlowNodeData>[]): string[] {
  return nodes
    .filter((n) => n.data.kind === 'agent' && n.data.promptName)
    .map((n) => n.data.promptName as string);
}

/** Build an ExportedFlow payload from the current canvas state. */
function buildExportPayload(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  name: string,
): ExportedFlow {
  return {
    schema: 'flow-export/v1',
    metadata: {
      id: '',
      name,
      exportedAt: new Date().toISOString(),
      version: '1',
    },
    graph: {
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
    },
    toolRefs: extractToolRefs(nodes),
    promptRefs: extractPromptRefs(nodes),
  };
}

// ── Shared button style ───────────────────────────────────────────────────────

interface ImportExportButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  primary?: boolean;
}

function ImportExportButton({ children, onClick, title, disabled, primary }: ImportExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        padding: '5px 11px',
        background: primary ? 'var(--primary, #a78bfa)' : 'var(--surface-2)',
        border: `1px solid ${primary ? 'transparent' : 'var(--border)'}`,
        borderRadius: 6,
        color: disabled
          ? 'var(--text-muted)'
          : primary
          ? 'var(--primary-foreground, #fff)'
          : 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        opacity: disabled ? 0.6 : 1,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '0.8';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = disabled ? '0.6' : '1';
      }}
    >
      {children}
    </button>
  );
}

// ── ExportFlowButton ──────────────────────────────────────────────────────────

export interface ExportFlowButtonProps {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  flowName?: string;
}

/**
 * Downloads the current flow as a .json file.
 *
 * Flow:
 *   1. Build an ExportedFlow payload from canvas state.
 *   2. POST to /api/flows/import to register it on the server and get an ID.
 *   3. GET /api/flows/:id/export and trigger a browser download.
 */
export function ExportFlowButton({
  nodes,
  edges,
  flowName = 'flow',
}: ExportFlowButtonProps) {
  const [status, setStatus] = useState<'idle' | 'exporting' | 'error'>('idle');

  const handleExport = useCallback(async () => {
    setStatus('exporting');
    try {
      const payload = buildExportPayload(nodes, edges, flowName);

      // Register the flow on the server to obtain an ID
      const importRes = await fetch('/api/flows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!importRes.ok) {
        const err = (await importRes.json()) as { error?: string };
        throw new Error(err.error ?? 'Failed to save flow for export');
      }

      const { flow } = (await importRes.json()) as ImportApiResult;

      // Fetch the canonical export document
      const exportRes = await fetch(`/api/flows/${flow.id}/export`);
      if (!exportRes.ok) {
        throw new Error('Failed to retrieve export from server');
      }

      const exportData = (await exportRes.json()) as ExportedFlow;

      // Trigger download
      const safeName = flowName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'flow';
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus('idle');
    } catch (err) {
      console.error('[ExportFlowButton]', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [nodes, edges, flowName]);

  return (
    <ImportExportButton
      onClick={handleExport}
      title="Export flow as JSON"
      disabled={status === 'exporting'}
      primary
    >
      {status === 'exporting' ? '⏳' : status === 'error' ? '✗' : '⬇'}{' '}
      {status === 'error' ? 'Export failed' : 'Export .json'}
    </ImportExportButton>
  );
}

// ── ImportFlowButton ──────────────────────────────────────────────────────────

export interface ImportFlowButtonProps {
  onImport: (
    nodes: Node<FlowNodeData>[],
    edges: Edge[],
    warnings: ImportWarning[],
  ) => void;
}

/**
 * Opens a file picker, validates the selected JSON via /api/flows/import,
 * and invokes onImport with the loaded nodes/edges and any warnings.
 */
export function ImportFlowButton({ onImport }: ImportFlowButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'importing' | 'error'>('idle');

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Allow re-selecting the same file next time
      e.target.value = '';

      setStatus('importing');
      try {
        const text = await file.text();

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error('Selected file is not valid JSON');
        }

        const res = await fetch('/api/flows/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? 'Import failed');
        }

        const result = (await res.json()) as ImportApiResult;

        onImport(result.flow.graph.nodes, result.flow.graph.edges, result.warnings);
        setStatus('idle');
      } catch (err) {
        console.error('[ImportFlowButton]', err);
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    },
    [onImport],
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <ImportExportButton
        onClick={() => fileInputRef.current?.click()}
        title="Import flow from a .json file"
        disabled={status === 'importing'}
      >
        {status === 'importing' ? '⏳' : status === 'error' ? '✗' : '⬆'}{' '}
        {status === 'error' ? 'Import failed' : 'Import .json'}
      </ImportExportButton>
    </>
  );
}

// ── CopyAsJsonButton ──────────────────────────────────────────────────────────

export interface CopyAsJsonButtonProps {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

/**
 * Copies the current flow graph as pretty-printed JSON to the clipboard.
 */
export function CopyAsJsonButton({ nodes, edges }: CopyAsJsonButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopy = useCallback(async () => {
    try {
      const json = graphToJson(nodes, edges);
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 1800);
    } catch (err) {
      console.error('[CopyAsJsonButton]', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  }, [nodes, edges]);

  return (
    <ImportExportButton
      onClick={handleCopy}
      title="Copy flow graph as JSON to clipboard"
    >
      {status === 'copied' ? '✓ Copied!' : status === 'error' ? '✗ Failed' : '📋 Copy JSON'}
    </ImportExportButton>
  );
}
