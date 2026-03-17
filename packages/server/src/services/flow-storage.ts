/**
 * Flow storage service.
 *
 * Handles file I/O for flow persistence using JSON files stored in a `.flows/`
 * directory at the project root (process.cwd()).
 *
 * Each flow is stored as `{id}.json` containing the full Flow object.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ─── Directory ────────────────────────────────────────────────────────────────

const FLOWS_DIR = path.join(process.cwd(), '.flows');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Flow {
  /** UUID assigned at creation time. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** React Flow node array. */
  nodes: unknown[];
  /** React Flow edge array. */
  edges: unknown[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    [key: string]: unknown;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ensure the .flows/ directory exists, creating it recursively if needed. */
function ensureFlowsDir(): void {
  if (!fs.existsSync(FLOWS_DIR)) {
    fs.mkdirSync(FLOWS_DIR, { recursive: true });
  }
}

/** Return the absolute path for a given flow ID. */
function flowPath(id: string): string {
  return path.join(FLOWS_DIR, `${id}.json`);
}

/** Generate a new UUID v4. */
function generateId(): string {
  return crypto.randomUUID();
}

// ─── CRUD operations ──────────────────────────────────────────────────────────

/**
 * Create a new flow and persist it to disk.
 * Generates a UUID for the flow and sets createdAt / updatedAt timestamps.
 */
export function createFlow(input: {
  name: string;
  nodes?: unknown[];
  edges?: unknown[];
  metadata?: Record<string, unknown>;
}): Flow {
  ensureFlowsDir();

  const now = new Date().toISOString();
  const flow: Flow = {
    id: generateId(),
    name: input.name,
    nodes: input.nodes ?? [],
    edges: input.edges ?? [],
    metadata: {
      ...input.metadata,
      createdAt: now,
      updatedAt: now,
    },
  };

  fs.writeFileSync(flowPath(flow.id), JSON.stringify(flow, null, 2), 'utf-8');
  return flow;
}

/**
 * Return all flows stored in the .flows/ directory.
 * Files that cannot be parsed are silently skipped.
 */
export function listFlows(): Flow[] {
  if (!fs.existsSync(FLOWS_DIR)) return [];

  try {
    return fs
      .readdirSync(FLOWS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const raw = fs.readFileSync(path.join(FLOWS_DIR, f), 'utf-8');
          return JSON.parse(raw) as Flow;
        } catch {
          return null;
        }
      })
      .filter((flow): flow is Flow => flow !== null);
  } catch {
    return [];
  }
}

/**
 * Return a single flow by ID, or `null` if it does not exist.
 */
export function getFlow(id: string): Flow | null {
  const filepath = flowPath(id);
  if (!fs.existsSync(filepath)) return null;

  try {
    const raw = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(raw) as Flow;
  } catch {
    return null;
  }
}

/**
 * Update an existing flow and persist the changes.
 * The `updatedAt` timestamp is refreshed automatically.
 * Returns the updated flow, or `null` if the flow does not exist.
 */
export function updateFlow(
  id: string,
  patch: {
    name?: string;
    nodes?: unknown[];
    edges?: unknown[];
    metadata?: Record<string, unknown>;
  },
): Flow | null {
  const existing = getFlow(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: Flow = {
    ...existing,
    name: patch.name ?? existing.name,
    nodes: patch.nodes ?? existing.nodes,
    edges: patch.edges ?? existing.edges,
    metadata: {
      ...existing.metadata,
      ...patch.metadata,
      updatedAt: now,
    },
  };

  fs.writeFileSync(flowPath(id), JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

/**
 * Delete a flow file by ID.
 * Returns `true` if deleted, `false` if the flow did not exist.
 */
export function deleteFlow(id: string): boolean {
  const filepath = flowPath(id);
  if (!fs.existsSync(filepath)) return false;

  fs.unlinkSync(filepath);
  return true;
}
