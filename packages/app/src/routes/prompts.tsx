/**
 * PromptsPage — Git-versioned prompt template playground.
 *
 * Layout:
 *   Left sidebar  — scrollable list of available prompt templates
 *   Right panel   — vertically split:
 *     Top ~45%    — PromptEditor (edit body, set variables, pick model, save)
 *     Bottom ~55% — Live test chat (streams a real response from POST /api/chat)
 *
 * Data flow:
 *   Load  → GET /api/prompts             (list from filesystem)
 *   Edit  → local state                  (content, variables, model)
 *   Save  → PUT /api/prompts/:role       (writes body back to the .md file)
 *   Test  → POST /api/chat               (system = substituted prompt content)
 *
 * Streaming:
 *   The test chat reads the Vercel AI SDK UI message stream and parses
 *   `0:"text chunk"` lines to reconstruct the assistant reply in real-time.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { PromptEditor, applyVariables } from '../components/prompt-editor.js';
import { usePromptEditor, type PromptFile } from '../hooks/use-prompt-editor.js';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/prompts')({
  component: PromptsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── NewPromptModal ───────────────────────────────────────────────────────────

interface NewPromptModalProps {
  onConfirm: (id: string, name: string) => void;
  onCancel: () => void;
}

function NewPromptModal({ onConfirm, onCancel }: NewPromptModalProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!safeId) return;
    onConfirm(safeId, name || safeId);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--background)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '1.5rem',
          width: 360,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>New Prompt</h2>
        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: '0.8125rem',
              marginBottom: '0.75rem',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Role / ID</span>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. code-reviewer"
              autoFocus
              required
              style={{
                padding: '6px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--foreground)',
                fontSize: '0.8125rem',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </label>

          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: '0.8125rem',
              marginBottom: '1.25rem',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Display Name (optional)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Code Reviewer"
              style={{
                padding: '6px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--foreground)',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '6px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-secondary)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!safeId}
              style={{
                padding: '6px 14px',
                background: safeId ? 'var(--primary)' : 'var(--surface-3)',
                border: 'none',
                borderRadius: 4,
                color: safeId ? 'var(--primary-foreground)' : 'var(--text-muted)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: safeId ? 'pointer' : 'not-allowed',
              }}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── PromptsPage ──────────────────────────────────────────────────────────────

function PromptsPage() {
  // ── Prompt list state ────────────────────────────────────────────────────
  const [prompts, setPrompts] = useState<PromptFile[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // ── Prompt editor hook ───────────────────────────────────────────────────
  const editor = usePromptEditor();

  // ── Model and variable state ─────────────────────────────────────────────
  const [model, setModel] = useState('claude-opus-4-6');
  const [variables, setVariables] = useState<Record<string, string>>({});

  // ── Chat test state ──────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Load prompt list ─────────────────────────────────────────────────────

  const fetchPrompts = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/prompts');
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = (await res.json()) as PromptFile[];
      setPrompts(data);
      setListError(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrompts();
  }, [fetchPrompts]);

  // ── Auto-scroll chat to bottom ───────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Auto-dismiss save confirmation ───────────────────────────────────────

  useEffect(() => {
    if (editor.saveConfirmation) {
      const timer = setTimeout(() => {
        editor.dismissConfirmation();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [editor.saveConfirmation, editor.dismissConfirmation]);

  // ── Select a prompt ──────────────────────────────────────────────────────

  const handleSelect = (p: PromptFile) => {
    editor.load(p);
    setVariables({});
    setMessages([]);
    setStreamError(null);
  };

  // ── Save prompt ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    const updated = await editor.save();
    if (updated) {
      setPrompts((prev) => prev.map((p) => (p.role === updated.role ? updated : p)));
    }
  };

  // ── Create new prompt ────────────────────────────────────────────────────

  const handleCreatePrompt = async (id: string, name: string) => {
    setShowNewModal(false);
    const created = await editor.create(id, name);
    if (created) {
      setPrompts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      editor.load(created);
      setVariables({});
      setMessages([]);
    }
  };

  // ── Send test message ────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!userInput.trim() || isStreaming) return;

    const systemPrompt = applyVariables(editor.body, variables);
    const userMsg: ChatMessage = { role: 'user', content: userInput.trim() };
    const historyWithUser = [...messages, userMsg];

    setMessages(historyWithUser);
    setUserInput('');
    setIsStreaming(true);
    setStreamError(null);

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyWithUser.map((m) => ({ role: m.role, content: m.content })),
          model,
          system: systemPrompt || undefined,
          maxSteps: 3,
        }),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      if (!res.body) throw new Error('No response body from server');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('0:')) continue;
          try {
            const delta = JSON.parse(line.slice(2)) as string;
            assistantText += delta;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = { ...last, content: assistantText };
              }
              return copy;
            });
          } catch {
            // Non-text chunk — skip silently
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;

      setStreamError(err instanceof Error ? err.message : 'Streaming failed');
      setMessages((prev) => {
        if (prev[prev.length - 1]?.content === '') return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStopStream = () => {
    abortRef.current?.abort();
  };

  const handleVariableChange = (name: string, value: string) => {
    setVariables((prev) => ({ ...prev, [name]: value }));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        background: 'var(--background)',
        color: 'var(--foreground)',
        overflow: 'hidden',
      }}
    >
      {/* ── Left sidebar: prompt list ─────────────────────────────────── */}
      <aside
        data-testid="prompt-list-panel"
        style={{
          width: '17rem',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1rem 0.875rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Prompts</h1>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              style={{
                padding: '3px 10px',
                background: 'var(--primary)',
                border: 'none',
                borderRadius: 4,
                color: 'var(--primary-foreground)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + New
            </button>
          </div>
          <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {loadingList
              ? 'Loading\u2026'
              : `${prompts.length} template${prompts.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Error */}
        {listError && (
          <div
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(248,113,113,0.08)',
              borderBottom: '1px solid var(--border)',
              color: 'var(--error)',
              fontSize: '0.75rem',
              flexShrink: 0,
            }}
          >
            {listError}
          </div>
        )}

        {/* Prompt list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!loadingList && prompts.length === 0 && !listError && (
            <div
              style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
              }}
            >
              No prompts found.
              <br />
              <span style={{ fontSize: '0.6875rem' }}>
                Click <strong>+ New</strong> to create your first prompt template.
              </span>
            </div>
          )}

          {prompts.map((p) => (
            <button
              key={p.role}
              type="button"
              onClick={() => handleSelect(p)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: editor.original?.role === p.role ? 'var(--surface-2)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                borderLeft:
                  editor.original?.role === p.role
                    ? '2px solid var(--primary)'
                    : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--foreground)',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                {p.name}
              </div>

              <div
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: p.metadata.description ? '0.2rem' : 0,
                }}
              >
                {p.role}
              </div>

              {p.metadata.description && (
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {p.metadata.description}
                </div>
              )}

              {/* Variable badges */}
              {p.variables.length > 0 && (
                <div style={{ marginTop: '0.375rem', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {p.variables.map((v) => (
                    <span
                      key={v}
                      style={{
                        fontSize: '0.625rem',
                        fontFamily: 'var(--font-mono)',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        padding: '1px 4px',
                        color: 'var(--primary)',
                      }}
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      {editor.original ? (
        <div
          data-testid="prompt-editor-panel"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {/* Panel header with frontmatter fields */}
          <div
            style={{
              padding: '0.625rem 1rem',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Name field */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Name
                <input
                  type="text"
                  value={editor.name}
                  onChange={(e) => editor.setName(e.target.value)}
                  style={{
                    padding: '3px 7px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--foreground)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    width: 180,
                    outline: 'none',
                  }}
                />
              </label>

              {/* Role (read-only) */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Role
                <span
                  style={{
                    padding: '3px 7px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {editor.role}
                </span>
              </label>

              {/* Version field */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Version
                <input
                  type="text"
                  value={editor.version}
                  onChange={(e) => editor.setVersion(e.target.value)}
                  style={{
                    padding: '3px 7px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--foreground)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    width: 80,
                    outline: 'none',
                  }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Unsaved changes indicator */}
              {editor.isDirty && (
                <span
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}
                >
                  Unsaved changes
                </span>
              )}

              {/* Save confirmation */}
              {editor.saveConfirmation && (
                <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                  {editor.saveConfirmation.message}
                </span>
              )}

              {/* Save error */}
              {editor.saveError && (
                <span
                  style={{ fontSize: '0.75rem', color: 'var(--error)' }}
                  title={editor.saveError}
                >
                  Save failed
                </span>
              )}

              {/* Save button */}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={editor.isSaving || !editor.isDirty}
                style={{
                  padding: '4px 14px',
                  background:
                    editor.isSaving || !editor.isDirty ? 'var(--surface-3)' : 'var(--primary)',
                  border: 'none',
                  borderRadius: 4,
                  color:
                    editor.isSaving || !editor.isDirty
                      ? 'var(--text-muted)'
                      : 'var(--primary-foreground)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: editor.isSaving || !editor.isDirty ? 'not-allowed' : 'pointer',
                  opacity: editor.isSaving ? 0.7 : 1,
                }}
              >
                {editor.isSaving ? 'Saving\u2026' : 'Save'}
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={() => {
                  editor.reset();
                  setMessages([]);
                }}
                style={{
                  padding: '4px 10px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                Close
              </button>
            </div>
          </div>

          {/* ── Split: Editor (top) + Chat test (bottom) ─────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* ── Prompt editor — top half ───────────────────────────────── */}
            <div
              style={{
                flex: '0 0 45%',
                overflow: 'hidden',
                borderBottom: '2px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <PromptEditor
                content={editor.body}
                onChange={editor.setBody}
                onSave={() => void handleSave()}
                isSaving={editor.isSaving}
                model={model}
                onModelChange={setModel}
                variables={variables}
                onVariableChange={handleVariableChange}
              />
            </div>

            {/* ── Chat test area — bottom half ───────────────────────────── */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: 'var(--surface)',
              }}
            >
              {/* Chat subheader */}
              <div
                style={{
                  padding: '6px 12px',
                  borderBottom: '1px solid var(--border)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                  }}
                >
                  Test Chat
                </span>

                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    style={{
                      padding: '2px 8px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-muted)',
                      fontSize: '0.6875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
                {messages.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: 'var(--text-muted)',
                      fontSize: '0.8125rem',
                      textAlign: 'center',
                    }}
                  >
                    <div>Type a message to test the prompt with a live response</div>
                  </div>
                ) : (
                  <>
                    {messages.map((m, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: '0.625rem',
                          display: 'flex',
                          justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '80%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 8,
                            background:
                              m.role === 'user' ? 'var(--primary)' : 'var(--surface-2)',
                            color:
                              m.role === 'user'
                                ? 'var(--primary-foreground)'
                                : 'var(--foreground)',
                            fontSize: '0.8125rem',
                            lineHeight: 1.55,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {m.content || <span style={{ opacity: 0.4 }}>...</span>}
                        </div>
                      </div>
                    ))}

                    {streamError && (
                      <div
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(248,113,113,0.08)',
                          borderRadius: 6,
                          color: 'var(--error)',
                          fontSize: '0.75rem',
                          marginTop: '0.5rem',
                        }}
                      >
                        {streamError}
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Input bar */}
              <div
                style={{
                  padding: '8px 12px',
                  borderTop: '1px solid var(--border)',
                  flexShrink: 0,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                }}
              >
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Type a test message\u2026 (Enter to send, Shift+Enter for newline)"
                  disabled={isStreaming}
                  rows={2}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--foreground)',
                    fontSize: '0.8125rem',
                    resize: 'none',
                    fontFamily: 'var(--font-sans)',
                    lineHeight: 1.4,
                    outline: 'none',
                  }}
                />

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStopStream}
                    style={{
                      padding: '7px 14px',
                      background: 'var(--surface-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      color: 'var(--text-secondary)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!userInput.trim()}
                    style={{
                      padding: '7px 14px',
                      background: userInput.trim() ? 'var(--primary)' : 'var(--surface-2)',
                      border: 'none',
                      borderRadius: 6,
                      color: userInput.trim()
                        ? 'var(--primary-foreground)'
                        : 'var(--text-muted)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: userInput.trim() ? 'pointer' : 'not-allowed',
                      flexShrink: 0,
                    }}
                  >
                    Send
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state — no prompt selected */
        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>
              Select a template from the sidebar to start editing.
            </p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Use{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>{'{{variable}}'}</code>{' '}
              placeholders for dynamic substitution.
            </p>
          </div>
        </main>
      )}

      {/* ── New prompt modal ─────────────────────────────────────────────── */}
      {showNewModal && (
        <NewPromptModal
          onConfirm={(id, name) => void handleCreatePrompt(id, name)}
          onCancel={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}
