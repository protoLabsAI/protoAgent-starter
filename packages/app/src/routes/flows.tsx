/**
 * flows.tsx — Visual LangGraph flow builder page.
 *
 * Layout:
 *   Top toolbar  — title, save/load, export buttons
 *   Canvas       — React Flow interactive graph (flex 1)
 *   Right panel  — Node palette / property inspector (240 px)
 *
 * Persistence: graph state is saved to localStorage under STORAGE_KEY.
 * Export:       generates a @langchain/langgraph TypeScript module.
 */

import { useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ReactFlowProvider, useNodesState, useEdgesState } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';

// React Flow base CSS — required for handles, edges, controls, etc.
import '@xyflow/react/dist/style.css';

import { FlowCanvas } from '../components/flow-builder/canvas.js';
import { FlowSidebar } from '../components/flow-builder/sidebar.js';
import { generateLangGraphCode, graphToJson } from '../components/flow-builder/codegen.js';
import type { FlowNodeData } from '../components/flow-builder/nodes.js';
import { ASSISTANT_FLOW_NODES, ASSISTANT_FLOW_EDGES } from '../components/flow-builder/default-flows.js';
import {
  ExportFlowButton,
  ImportFlowButton,
  CopyAsJsonButton,
} from '../components/flow-builder/import-export.js';
import type { ImportWarning } from '../components/flow-builder/import-export.js';

// ── Route definition ──────────────────────────────────────────────────────────

export const Route = createFileRoute('/flows')({
  component: FlowsPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'flow-builder-v1';

// ── Initial graph — load saved flow or fall back to the Assistant default ─────

function loadInitialGraph(): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const json = JSON.parse(raw) as { nodes?: Node<FlowNodeData>[]; edges?: Edge[] };
      if (Array.isArray(json.nodes) && json.nodes.length > 0) {
        return {
          nodes: json.nodes,
          edges: Array.isArray(json.edges) ? json.edges : [],
        };
      }
    } catch {
      // ignore malformed data — fall through to default
    }
  }
  // First visit or empty storage: load the default Assistant flow
  return { nodes: ASSISTANT_FLOW_NODES, edges: ASSISTANT_FLOW_EDGES };
}

// ── FlowsPage (inner) ─────────────────────────────────────────────────────────

function FlowsPageInner() {
  const initial = loadInitialGraph();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'loaded'>('idle');
  const [importWarnings, setImportWarnings] = useState<ImportWarning[]>([]);

  // ── Save to localStorage ───────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const json = graphToJson(nodes, edges);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1800);
  }, [nodes, edges]);

  // ── Load from localStorage ─────────────────────────────────────────────────
  const handleLoad = useCallback(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const json = JSON.parse(raw) as {
        nodes: Node<FlowNodeData>[];
        edges: Edge[];
      };
      if (Array.isArray(json.nodes)) setNodes(json.nodes);
      if (Array.isArray(json.edges)) setEdges(json.edges);
      setSelectedNode(null);
      setSaveStatus('loaded');
      setTimeout(() => setSaveStatus('idle'), 1800);
    } catch {
      // ignore malformed data
    }
  }, [setNodes, setEdges]);

  // ── Export TypeScript ──────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const code = generateLangGraphCode(nodes, edges);
    const blob = new Blob([code], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph.ts';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  // ── Node data change from inspector ───────────────────────────────────────
  const handleNodeDataChange = useCallback(
    (id: string, patch: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
      setSelectedNode((prev) =>
        prev?.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev,
      );
    },
    [setNodes],
  );

  // ── Delete node ────────────────────────────────────────────────────────────
  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNode(null);
    },
    [setNodes, setEdges],
  );

  // ── Handle imported flow ───────────────────────────────────────────────────
  const handleImport = useCallback(
    (importedNodes: Node<FlowNodeData>[], importedEdges: Edge[], warnings: ImportWarning[]) => {
      setNodes(importedNodes);
      setEdges(importedEdges);
      setSelectedNode(null);
      setImportWarnings(warnings);
      // Auto-dismiss warnings after 8 seconds
      if (warnings.length > 0) {
        setTimeout(() => setImportWarnings([]), 8000);
      }
    },
    [setNodes, setEdges],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
        overflow: 'hidden',
      }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <header
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚙️</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Flow Builder</span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              padding: '2px 7px',
              background: 'var(--surface-2)',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            LangGraph
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Status badge */}
          {saveStatus !== 'idle' && (
            <span
              style={{
                fontSize: 11,
                color: saveStatus === 'saved' ? 'var(--success, #22c55e)' : '#3b82f6',
                padding: '2px 8px',
                background: saveStatus === 'saved' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                borderRadius: 10,
              }}
            >
              {saveStatus === 'saved' ? '✓ Saved' : '✓ Loaded'}
            </span>
          )}

          <ToolbarButton onClick={handleLoad} title="Load from localStorage">
            📂 Load
          </ToolbarButton>
          <ToolbarButton onClick={handleSave} title="Save to localStorage">
            💾 Save
          </ToolbarButton>
          <ToolbarButton onClick={handleExport} title="Export as graph.ts" primary>
            ⬇ Export .ts
          </ToolbarButton>

          {/* Divider */}
          <span
            style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }}
          />

          <ImportFlowButton onImport={handleImport} />
          <ExportFlowButton nodes={nodes} edges={edges} flowName="flow" />
          <CopyAsJsonButton nodes={nodes} edges={edges} />
        </div>
      </header>

      {/* ── Import warnings banner ───────────────────────────────────────── */}
      {importWarnings.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(251,191,36,0.1)',
            borderBottom: '1px solid rgba(251,191,36,0.3)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#d97706',
              marginBottom: 4,
            }}
          >
            ⚠ Import warnings — some references are missing on this instance:
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {importWarnings.map((w, i) => (
              <li
                key={i}
                style={{ fontSize: 11, color: '#92400e', lineHeight: 1.5 }}
              >
                {w.message}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setImportWarnings([])}
            style={{
              marginTop: 6,
              padding: '2px 8px',
              background: 'transparent',
              border: '1px solid rgba(217,119,6,0.4)',
              borderRadius: 4,
              color: '#d97706',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Body: canvas + sidebar ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgesUpdate={setEdges}
            onNodeSelect={setSelectedNode}
            onNodesUpdate={setNodes}
          />
        </div>

        {/* Sidebar */}
        <FlowSidebar
          selectedNode={selectedNode}
          onNodeDataChange={handleNodeDataChange}
          onDeleteNode={handleDeleteNode}
        />
      </div>
    </div>
  );
}

// ── FlowsPage (wrapper with ReactFlowProvider) ────────────────────────────────

function FlowsPage() {
  return (
    <ReactFlowProvider>
      <FlowsPageInner />
    </ReactFlowProvider>
  );
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolbarButton({
  children,
  onClick,
  title,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: '5px 11px',
        background: primary ? 'var(--primary, #a78bfa)' : 'var(--surface-2)',
        border: `1px solid ${primary ? 'transparent' : 'var(--border)'}`,
        borderRadius: 6,
        color: primary ? 'var(--primary-foreground, #fff)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.8')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
    >
      {children}
    </button>
  );
}
