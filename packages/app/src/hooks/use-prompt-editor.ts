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
  /** Git commit hash from the save operation, if available */
  commitHash?: string;
  /** Git commit message, if available */
  commitMessage?: string;
}

export interface UsePromptEditorState {
  /** The currently loaded prompt (original, unedited) */
  original: PromptFile | null;
  /** Edited template body */
  body: string;
  /** Edited name */
  name: string;
  /** Edited version */
  version: string;
  /** Edited role (only used when creating a new prompt) */
  role: string;
  /** True when there are unsaved changes */
  isDirty: boolean;
  /** True while a save is in progress */
  isSaving: boolean;
  /** Error message from the last save attempt */
  saveError: string | null;
  /** Confirmation info from the last successful save */
  saveConfirmation: { message: string; commitHash?: string } | null;
}

export interface UsePromptEditorActions {
  /** Load a prompt into the editor, resetting dirty state */
  load: (prompt: PromptFile) => void;
  /** Reset the editor to a blank state */
  reset: () => void;
  /** Update the template body */
  setBody: (body: string) => void;
  /** Update the prompt name */
  setName: (name: string) => void;
  /** Update the version string */
  setVersion: (version: string) => void;
  /** Update the role (id) — only meaningful for new prompts */
  setRole: (role: string) => void;
  /** Save changes via PUT /api/prompts/:role */
  save: () => Promise<PromptFile | null>;
  /** Create a new prompt via POST /api/prompts */
  create: (id: string, name: string) => Promise<PromptFile | null>;
  /** Dismiss the save confirmation banner */
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

  // Keep a ref to the current state for use in async callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Load ─────────────────────────────────────────────────────────────────

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

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  // ── Field setters ────────────────────────────────────────────────────────

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

  // ── Save ─────────────────────────────────────────────────────────────────

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
        saveConfirmation: {
          message: confirmMessage,
          commitHash: updated.commitHash,
        },
      }));

      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setState((prev) => ({ ...prev, isSaving: false, saveError: message }));
      return null;
    }
  }, []);

  // ── Create ───────────────────────────────────────────────────────────────

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

      const created = (await res.json()) as PromptFile;
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create prompt';
      setState((prev) => ({ ...prev, saveError: message }));
      return null;
    }
  }, []);

  // ── Dismiss confirmation ─────────────────────────────────────────────────

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
