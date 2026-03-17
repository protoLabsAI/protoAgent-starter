/**
 * sidebar.tsx — Node palette and property inspector.
 *
 * Two modes:
 *   Palette   — shown when no node is selected; drag tiles onto the canvas
 *   Inspector — shown when a node is selected; edit its properties
 */

import { useState } from 'react';
import type { Node } from '@xyflow/react';
import { NODE_SPECS } from './nodes.js';
import type { FlowNodeData, NodeKind } from './nodes.js';
import { useTools } from '../../hooks/use-tools.js';
import type { ApiTool } from '../../hooks/use-tools.js';
import { usePrompts, useRoles } from '../../hooks/use-prompts.js';
import type { ApiPrompt, ApiRole } from '../../hooks/use-prompts.js';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FlowSidebarProps {
  selectedNode: Node<FlowNodeData> | null;
  onNodeDataChange: (id: string, data: Partial<FlowNodeData>) => void;
  onDeleteNode: (id: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FlowSidebar({ selectedNode, onNodeDataChange, onDeleteNode }: FlowSidebarProps) {
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {selectedNode ? (
        <Inspector
          node={selectedNode}
          onChange={(patch) => onNodeDataChange(selectedNode.id, patch)}
          onDelete={() => onDeleteNode(selectedNode.id)}
        />
      ) : (
        <Palette />
      )}
    </aside>
  );
}

// ── Node palette ──────────────────────────────────────────────────────────────

function Palette() {
  const { tools, loading, error } = useTools();

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, kind: NodeKind) => {
    event.dataTransfer.setData('application/flow-node-kind', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      <SidebarHeader title="Nodes" subtitle="Drag onto the canvas" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {NODE_SPECS.map((spec) => (
          <div
            key={spec.kind}
            draggable
            onDragStart={(e) => onDragStart(e, spec.kind)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '9px 10px',
              marginBottom: 6,
              borderRadius: 8,
              border: `1px solid ${spec.accent}44`,
              background: spec.bg,
              cursor: 'grab',
              userSelect: 'none',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateX(2px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 8px ${spec.accent}33`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = '';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '';
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{spec.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: spec.accent }}>{spec.label}</div>
              <div
                style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 1 }}
              >
                {spec.description}
              </div>
            </div>
          </div>
        ))}

        {/* Tool palette section */}
        <ToolPalette tools={tools} loading={loading} error={error} />

        <div
          style={{
            marginTop: 16,
            padding: '10px',
            borderRadius: 8,
            border: '1px dashed var(--border)',
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          💡 <strong>Tips</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
            <li>Drag a node to the canvas</li>
            <li>Click a node to inspect it</li>
            <li>Connect nodes by dragging handles</li>
            <li>Delete with Backspace</li>
          </ul>
        </div>
      </div>
    </>
  );
}

// ── Tool palette section ──────────────────────────────────────────────────────

interface ToolPaletteProps {
  tools: ApiTool[];
  loading: boolean;
  error: string | null;
}

function ToolPalette({ tools, loading, error }: ToolPaletteProps) {
  const toolSpec = NODE_SPECS.find((s) => s.kind === 'tool')!;

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, tool: ApiTool) => {
    event.dataTransfer.setData('application/flow-node-kind', 'tool');
    event.dataTransfer.setData('application/flow-tool-name', tool.name);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
          paddingLeft: 2,
        }}
      >
        Available Tools
      </div>

      {loading && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            padding: '6px 4px',
            fontStyle: 'italic',
          }}
        >
          Loading tools…
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 11,
            color: '#ef4444',
            padding: '6px 8px',
            background: 'rgba(239,68,68,0.08)',
            borderRadius: 6,
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && tools.length === 0 && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            padding: '6px 4px',
            fontStyle: 'italic',
          }}
        >
          No tools registered
        </div>
      )}

      {tools.map((tool) => (
        <div
          key={tool.name}
          draggable
          onDragStart={(e) => onDragStart(e, tool)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '7px 8px',
            marginBottom: 5,
            borderRadius: 7,
            border: `1px solid ${toolSpec.accent}33`,
            background: toolSpec.bg,
            cursor: 'grab',
            userSelect: 'none',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = 'translateX(2px)';
            (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 8px ${toolSpec.accent}22`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = '';
            (e.currentTarget as HTMLDivElement).style.boxShadow = '';
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>🔧</span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 11,
                color: toolSpec.accent,
                fontFamily: 'var(--font-mono, monospace)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {tool.name}
            </div>
            {tool.metadata?.category && (
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  marginTop: 1,
                  fontStyle: 'italic',
                }}
              >
                {tool.metadata.category}
              </div>
            )}
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                lineHeight: 1.4,
                marginTop: 1,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {tool.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Property inspector ────────────────────────────────────────────────────────

interface InspectorProps {
  node: Node<FlowNodeData>;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onDelete: () => void;
}

function Inspector({ node, onChange, onDelete }: InspectorProps) {
  const { data } = node;
  const spec = NODE_SPECS.find((s) => s.kind === data.kind);
  if (!spec) return null;

  return (
    <>
      <SidebarHeader title={`${spec.icon} ${spec.label}`} subtitle={node.id} accent={spec.accent} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {/* Label */}
        <Field label="Label">
          <input
            type="text"
            value={data.label}
            onChange={(e) => onChange({ label: e.target.value })}
            style={inputStyle}
          />
        </Field>

        {/* Description */}
        <Field label="Description">
          <textarea
            rows={2}
            value={data.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Optional — describes what this node does"
          />
        </Field>

        {/* Kind-specific fields */}
        {data.kind === 'agent' && (
          <>
            <Field label="Model ID">
              <input
                type="text"
                value={data.model ?? ''}
                onChange={(e) => onChange({ model: e.target.value })}
                style={inputStyle}
                placeholder="claude-3-5-haiku-20241022"
              />
            </Field>
            <AgentInspectorFields data={data} onChange={onChange} />
          </>
        )}

        {data.kind === 'tool' && (
          <ToolInspectorFields data={data} onChange={onChange} />
        )}

        {data.kind === 'condition' && (
          <Field label="Routing condition">
            <textarea
              rows={2}
              value={data.condition ?? ''}
              onChange={(e) => onChange({ condition: e.target.value })}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="e.g. state.messages contains 'done'"
            />
          </Field>
        )}

        {data.kind === 'state' && (
          <Field label="State key">
            <input
              type="text"
              value={data.stateKey ?? ''}
              onChange={(e) => onChange({ stateKey: e.target.value })}
              style={inputStyle}
              placeholder="myField"
            />
          </Field>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '7px 12px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 6,
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          🗑 Delete node
        </button>
      </div>
    </>
  );
}

// ── Agent inspector fields (prompt picker + role picker) ──────────────────────

interface AgentInspectorFieldsProps {
  data: FlowNodeData;
  onChange: (patch: Partial<FlowNodeData>) => void;
}

function AgentInspectorFields({ data, onChange }: AgentInspectorFieldsProps) {
  const { prompts, loading: promptsLoading } = usePrompts();
  const { roles, loading: rolesLoading } = useRoles();
  const [showPromptPicker, setShowPromptPicker] = useState(!data.promptRef);
  const [showRolePicker, setShowRolePicker] = useState(false);

  const selectedPrompt = prompts.find((p) => p.id === data.promptRef) ?? null;
  const selectedRole = roles.find((r) => r.id === data.roleId) ?? null;

  const handleSelectPrompt = (prompt: ApiPrompt) => {
    onChange({ promptRef: prompt.id, promptName: prompt.name });
    setShowPromptPicker(false);
  };

  const handleSelectRole = (role: ApiRole) => {
    onChange({ roleId: role.id, roleName: role.name });
    setShowRolePicker(false);
  };

  return (
    <>
      {/* Prompt picker */}
      <Field label="System Prompt">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div
            style={{
              ...inputStyle,
              flex: 1,
              color: data.promptName ? 'var(--foreground)' : 'var(--text-muted)',
              fontStyle: data.promptName ? 'normal' : 'italic',
            }}
          >
            {data.promptName ?? 'None selected'}
          </div>
          <button
            type="button"
            onClick={() => { setShowPromptPicker((v) => !v); setShowRolePicker(false); }}
            title="Pick from registered prompts"
            style={{
              flexShrink: 0,
              padding: '4px 8px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Browse
          </button>
        </div>
      </Field>

      {/* Prompt picker dropdown */}
      {showPromptPicker && (
        <div
          style={{
            marginBottom: 10,
            border: '1px solid var(--border)',
            borderRadius: 7,
            overflow: 'hidden',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {promptsLoading && (
            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Loading prompts…
            </div>
          )}
          {!promptsLoading && prompts.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No prompts registered
            </div>
          )}
          {prompts.map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              onClick={() => handleSelectPrompt(prompt)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                background: prompt.id === data.promptRef ? 'rgba(59,130,246,0.12)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--foreground)',
              }}
            >
              <div style={{ fontWeight: 700, color: '#3b82f6', fontSize: 11 }}>
                {prompt.name}
              </div>
              {prompt.description && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                  {prompt.description}
                </div>
              )}
              {prompt.variables && prompt.variables.length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                  Variables: {prompt.variables.join(', ')}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Template preview for selected prompt */}
      {selectedPrompt && !showPromptPicker && (
        <PromptTemplatePreview prompt={selectedPrompt} />
      )}

      {/* Role picker */}
      <Field label="Role (shortcut)">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div
            style={{
              ...inputStyle,
              flex: 1,
              color: data.roleName ? 'var(--foreground)' : 'var(--text-muted)',
              fontStyle: data.roleName ? 'normal' : 'italic',
            }}
          >
            {data.roleName ?? 'None selected'}
          </div>
          <button
            type="button"
            onClick={() => { setShowRolePicker((v) => !v); setShowPromptPicker(false); }}
            title="Pick from available roles"
            style={{
              flexShrink: 0,
              padding: '4px 8px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Browse
          </button>
        </div>
      </Field>

      {/* Role picker dropdown */}
      {showRolePicker && (
        <div
          style={{
            marginBottom: 10,
            border: '1px solid var(--border)',
            borderRadius: 7,
            overflow: 'hidden',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {rolesLoading && (
            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Loading roles…
            </div>
          )}
          {!rolesLoading && roles.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No roles available
            </div>
          )}
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => handleSelectRole(role)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                background: role.id === data.roleId ? 'rgba(168,85,247,0.12)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--foreground)',
              }}
            >
              <div style={{ fontWeight: 700, color: '#a855f7', fontSize: 11 }}>
                {role.name}
              </div>
              {role.description && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                  {role.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Show selected role's system prompt */}
      {selectedRole && !showRolePicker && selectedRole.systemPrompt && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 4,
            }}
          >
            Role System Prompt
          </div>
          <pre
            style={{
              margin: 0,
              padding: '6px 8px',
              background: 'var(--surface-2)',
              border: '1px solid rgba(168,85,247,0.3)',
              borderRadius: 5,
              fontSize: 9,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono, monospace)',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: 120,
              overflowY: 'auto',
            }}
          >
            {selectedRole.systemPrompt}
          </pre>
        </div>
      )}
    </>
  );
}

// ── Prompt template preview ────────────────────────────────────────────────────

function PromptTemplatePreview({ prompt }: { prompt: ApiPrompt }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {/* Variables badge row */}
      {prompt.variables && prompt.variables.length > 0 && (
        <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {prompt.variables.map((v) => (
            <span
              key={v}
              style={{
                display: 'inline-block',
                padding: '1px 7px',
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 10,
                fontSize: 10,
                color: '#3b82f6',
                fontWeight: 600,
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}

      {/* Template preview */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}
      >
        Template Preview
      </div>
      <pre
        style={{
          margin: 0,
          padding: '6px 8px',
          background: 'var(--surface-2)',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 5,
          fontSize: 9,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono, monospace)',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: 120,
          overflowY: 'auto',
        }}
      >
        {prompt.template}
      </pre>
    </div>
  );
}

// ── Tool inspector fields ─────────────────────────────────────────────────────

interface ToolInspectorFieldsProps {
  data: FlowNodeData;
  onChange: (patch: Partial<FlowNodeData>) => void;
}

function ToolInspectorFields({ data, onChange }: ToolInspectorFieldsProps) {
  const { tools, loading } = useTools();
  const [showPicker, setShowPicker] = useState(!data.toolName);

  // Find the currently selected tool
  const selectedTool = tools.find((t) => t.name === data.toolName) ?? null;

  const handleSelectTool = (tool: ApiTool) => {
    onChange({ toolName: tool.name, label: tool.name });
    setShowPicker(false);
  };

  return (
    <>
      <Field label="Tool function name">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            value={data.toolName ?? ''}
            onChange={(e) => onChange({ toolName: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
            placeholder="myTool"
          />
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            title="Pick from registered tools"
            style={{
              flexShrink: 0,
              padding: '4px 8px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Browse
          </button>
        </div>
      </Field>

      {/* Tool picker — shown when no tool selected or Browse clicked */}
      {showPicker && (
        <div
          style={{
            marginBottom: 10,
            border: '1px solid var(--border)',
            borderRadius: 7,
            overflow: 'hidden',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {loading && (
            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Loading tools…
            </div>
          )}
          {!loading && tools.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No tools registered
            </div>
          )}
          {tools.map((tool) => (
            <button
              key={tool.name}
              type="button"
              onClick={() => handleSelectTool(tool)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                background: tool.name === data.toolName ? 'rgba(249,115,22,0.12)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--foreground)',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#f97316',
                  fontSize: 11,
                }}
              >
                {tool.name}
              </div>
              {tool.metadata?.category && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {tool.metadata.category}
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                {tool.description}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected tool schema display */}
      {selectedTool && !showPicker && (
        <ToolSchemaView tool={selectedTool} />
      )}
    </>
  );
}

// ── Tool schema viewer ────────────────────────────────────────────────────────

function ToolSchemaView({ tool }: { tool: ApiTool }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {/* Category badge */}
      {tool.metadata?.category && (
        <div style={{ marginBottom: 6 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '1px 7px',
              background: 'rgba(249,115,22,0.15)',
              border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: 10,
              fontSize: 10,
              color: '#f97316',
              fontWeight: 600,
            }}
          >
            {tool.metadata.category}
          </span>
        </div>
      )}

      {/* Input schema */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}
      >
        Input Schema
      </div>
      <pre
        style={{
          margin: 0,
          padding: '6px 8px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 5,
          fontSize: 9,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono, monospace)',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: 120,
          overflowY: 'auto',
          marginBottom: 6,
        }}
      >
        {JSON.stringify(tool.inputSchema, null, 2)}
      </pre>

      {/* Output schema */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}
      >
        Output Schema
      </div>
      <pre
        style={{
          margin: 0,
          padding: '6px 8px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 5,
          fontSize: 9,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono, monospace)',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: 120,
          overflowY: 'auto',
        }}
      >
        {JSON.stringify(tool.outputSchema, null, 2)}
      </pre>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SidebarHeader({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: accent ?? 'var(--foreground)',
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono, monospace)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '5px 8px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--foreground)',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
};
