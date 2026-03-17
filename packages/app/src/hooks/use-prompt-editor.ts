/**
 * usePromptEditor — Encapsulates editing state and API interactions for a single
 * prompt template.
 *
 * Responsibilities:
 *   - Track edits to body, name, and version fields
 *   - Detect unsaved changes
 *   - Save via PUT /api/prompts/:role
 *   - Create via POST /api/prompts
 *   - Surface save confirmation with git commit info
 *
 * Usage:
 *   const editor = usePromptEditor();
 *   editor.load(prompt);
 *   editor.setBody('...');
 *   await editor.save();
 */

import { useState, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/prompts and GET /api/prompts/:role */
export interface PromptFile {
  role: string;
  name: string;
  version: string;
  template: string;
  variables: string[];
  metadata: {
    description: string;
    [key: string]: unknown;
  };
}

/** Returned by PUT /api/prompts/:role — same as PromptFile but may include commit info */
export interface SaveResult extends PromptFile {
  commitHash?: string;
  commitMessage?: string;
}

export interface UsePromptEditorState {
  original: PromptFile | null;
  body: string;
  name: string;
  version: string;
  role: string;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  saveConfirmation: { message: string; commitHash?: string } | null;
}

export interface UsePromptEditorActions {
  load: (prompt: PromptFile) => void;
  reset: () => void;
  setBody: (body: string) => void;
  setName: (name: string) => void;
  setVersion: (version: string) => void;
  setRole: (role: string) => void;
  save: () => Promise<PromptFile | null>;
  create: (id: string, name: string) => Promise<PromptFile | null>;
  dismissConfirmation: () => void;
}

export type UsePromptEditorResult = UsePromptEditorState & UsePromptEditorActions;

// ── Hook ─────────────────────────────────────────────────────────────────────

const DEFAULT_STATE: UsePromptEditorState = {
  original: null,
  body: '',
  name: '',
  version: '1.0.0',
  role: '',
  isDirty: false,
  isSaving: false,
  saveError: null,
  saveConfirmation: null,
};

export function usePromptEditor(): UsePromptEditorResult {
  const [state, setState] = useState<UsePromptEditorState>(DEFAULT_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback((prompt: PromptFile) => {
    setState({
      original: prompt,
      body: prompt.template,
      name: prompt.name,
      version: prompt.version,
      role: prompt.role,
      isDirty: false,
      isSaving: false,
      saveError: null,
      saveConfirmation: null,
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const setBody = useCallback((body: string) => {
    setState((prev) => ({ ...prev, body, isDirty: true }));
  }, []);

  const setName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, name, isDirty: true }));
  }, []);

  const setVersion = useCallback((version: string) => {
    setState((prev) => ({ ...prev, version, isDirty: true }));
  }, []);

  const setRole = useCallback((role: string) => {
    setState((prev) => ({ ...prev, role, isDirty: true }));
  }, []);

  const save = useCallback(async (): Promise<PromptFile | null> => {
    const current = stateRef.current;
    if (!current.original) return null;

    setState((prev) => ({ ...prev, isSaving: true, saveError: null, saveConfirmation: null }));

    try {
      const res = await fetch(`/api/prompts/${current.original.role}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: current.body,
          name: current.name,
          version: current.version,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `Server returned ${res.status}`);
      }

      const updated = (await res.json()) as SaveResult;
      const confirmMessage = updated.commitHash
        ? `Saved \u2014 commit ${updated.commitHash.slice(0, 7)}`
        : 'Saved successfully';

      setState((prev) => ({
        ...prev,
        original: updated,
        isDirty: false,
        isSaving: false,
        saveError: null,
        saveConfirmation: { message: confirmMessage, commitHash: updated.commitHash },
      }));

      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setState((prev) => ({ ...prev, isSaving: false, saveError: message }));
      return null;
    }
  }, []);

  const create = useCallback(async (id: string, name: string): Promise<PromptFile | null> => {
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, version: '1.0.0', content: '' }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `Server returned ${res.status}`);
      }

      return (await res.json()) as PromptFile;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create prompt';
      setState((prev) => ({ ...prev, saveError: message }));
      return null;
    }
  }, []);

  const dismissConfirmation = useCallback(() => {
    setState((prev) => ({ ...prev, saveConfirmation: null }));
  }, []);

  return {
    ...state,
    load,
    reset,
    setBody,
    setName,
    setVersion,
    setRole,
    save,
    create,
    dismissConfirmation,
  };
}
