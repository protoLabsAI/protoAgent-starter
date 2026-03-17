/**
 * FlowList — Sidebar panel showing all saved flows.
 *
 * Displays each flow with its name and last-updated timestamp.
 * Clicking a row loads it onto the canvas.
 * A trash button deletes the flow.
 * A "+ New Flow" button creates a fresh flow via the API.
 */

import React from 'react';
import type { ApiFlow } from '../../hooks/use-flow-storage.js';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FlowListProps {
  flows: ApiFlow[];
  loadingList: boolean;
  currentFlowId: string | null;
  onLoadFlow: (id: string) => void;
  onNewFlow: () => void;
  onDeleteFlow: (id: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FlowList({
  flows,
  loadingList,
  currentFlowId,
  onLoadFlow,
  onNewFlow,
  onDeleteFlow,
}: FlowListProps) {
  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
          SAVED FLOWS
        </span>
        <button
          type="button"
          onClick={onNewFlow}
          title="New flow"
          style={{
            padding: '3px 8px',
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--primary, #a78bfa)',
            color: 'var(--primary-foreground, #fff)',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          + New
        </button>
      </div>

      {/* Flow list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loadingList ? (
          <div
            style={{
              padding: '16px 12px',
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            Loading...
          </div>
        ) : flows.length === 0 ? (
          <div
            style={{
              padding: '16px 12px',
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            No saved flows yet.
            <br />
            Click + New to start.
          </div>
        ) : (
          flows.map((flow) => {
            const isActive = flow.id === currentFlowId;
            return (
              <div
                key={flow.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '7px 8px 7px 12px',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(167,139,250,0.12)' : 'transparent',
                  borderLeft: isActive
                    ? '3px solid var(--primary, #a78bfa)'
                    : '3px solid transparent',
                  gap: 6,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLDivElement).style.background =
                      'var(--surface-2, rgba(255,255,255,0.05))';
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
                onClick={() => onLoadFlow(flow.id)}
              >
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--primary, #a78bfa)' : 'var(--foreground)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {flow.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginTop: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {formatDate(flow.metadata.updatedAt)}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  title="Delete flow"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${flow.name}"?`)) {
                      onDeleteFlow(flow.id);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                    padding: '2px 4px',
                    borderRadius: 4,
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                  }}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
