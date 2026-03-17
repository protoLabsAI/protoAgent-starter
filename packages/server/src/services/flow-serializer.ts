/**
 * Flow Serializer service.
 *
 * Handles export and import of flow graphs as self-contained JSON documents.
 *
 * Export format includes:
 *   - graph      — nodes and edges that make up the flow
 *   - toolRefs   — names of tools referenced by the flow
 *   - promptRefs — roles of prompts referenced by the flow
 *   - metadata   — id, name, description, exportedAt, version
 *
 * The in-memory flow store is keyed by flow ID.
 */

import { randomUUID } from 'node:crypto';
import { registry } from '../tools/registry.js';
import fs from 'node:fs';
import path from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlowNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
  [key: string]: unknown;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowMetadata {
  id: string;
  name: string;
  description?: string;
  exportedAt: string;
  version: string;
}

export interface ExportedFlow {
  schema: 'flow-export/v1';
  metadata: FlowMetadata;
  graph: FlowGraph;
  toolRefs: string[];
  promptRefs: string[];
}

export interface StoredFlow {
  id: string;
  name: string;
  description?: string;
  graph: FlowGraph;
  toolRefs: string[];
  promptRefs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ImportWarning {
  type: 'missing_tool' | 'missing_prompt';
  ref: string;
  message: string;
}

export interface ImportResult {
  flow: StoredFlow;
  warnings: ImportWarning[];
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const flowStore = new Map<string, StoredFlow>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROMPTS_DIR = path.join(process.cwd(), 'prompts');

/**
 * Check whether a prompt file exists for the given role.
 */
function promptExists(role: string): boolean {
  const filepath = path.join(PROMPTS_DIR, `${role}.md`);
  try {
    return fs.existsSync(filepath);
  } catch {
    return false;
  }
}

/**
 * Validate the structure of an imported flow document.
 * Throws an error with a descriptive message if validation fails.
 */
function validateExportedFlow(data: unknown): asserts data is ExportedFlow {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Import payload must be a JSON object');
  }

  const obj = data as Record<string, unknown>;

  if (obj['schema'] !== 'flow-export/v1') {
    throw new Error('Invalid or missing "schema" field — expected "flow-export/v1"');
  }

  if (typeof obj['metadata'] !== 'object' || obj['metadata'] === null) {
    throw new Error('"metadata" must be an object');
  }

  const meta = obj['metadata'] as Record<string, unknown>;
  if (typeof meta['name'] !== 'string' || !meta['name']) {
    throw new Error('"metadata.name" must be a non-empty string');
  }

  if (typeof obj['graph'] !== 'object' || obj['graph'] === null) {
    throw new Error('"graph" must be an object');
  }

  const graph = obj['graph'] as Record<string, unknown>;
  if (!Array.isArray(graph['nodes'])) {
    throw new Error('"graph.nodes" must be an array');
  }
  if (!Array.isArray(graph['edges'])) {
    throw new Error('"graph.edges" must be an array');
  }

  if (!Array.isArray(obj['toolRefs'])) {
    throw new Error('"toolRefs" must be an array');
  }

  if (!Array.isArray(obj['promptRefs'])) {
    throw new Error('"promptRefs" must be an array');
  }
}

// ─── FlowSerializer ───────────────────────────────────────────────────────────

export class FlowSerializer {
  /**
   * Export a stored flow as a self-contained JSON document.
   * Returns `null` if the flow does not exist.
   */
  exportFlow(flowId: string): ExportedFlow | null {
    const flow = flowStore.get(flowId);
    if (!flow) return null;

    const exported: ExportedFlow = {
      schema: 'flow-export/v1',
      metadata: {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        exportedAt: new Date().toISOString(),
        version: '1',
      },
      graph: flow.graph,
      toolRefs: flow.toolRefs,
      promptRefs: flow.promptRefs,
    };

    return exported;
  }

  /**
   * Import a flow from an exported JSON document.
   * Validates structure, checks for missing tool/prompt references, and
   * persists the flow with a new ID.
   */
  importFlow(data: unknown): ImportResult {
    validateExportedFlow(data);

    const warnings: ImportWarning[] = [];

    // Check tool references against the registry
    const registeredToolNames = new Set(registry.listTools().map((t) => t.name));
    for (const toolRef of data.toolRefs) {
      if (typeof toolRef === 'string' && !registeredToolNames.has(toolRef)) {
        warnings.push({
          type: 'missing_tool',
          ref: toolRef,
          message: `Tool "${toolRef}" is referenced in the flow but is not registered on this instance`,
        });
      }
    }

    // Check prompt references against the filesystem
    for (const promptRef of data.promptRefs) {
      if (typeof promptRef === 'string' && !promptExists(promptRef)) {
        warnings.push({
          type: 'missing_prompt',
          ref: promptRef,
          message: `Prompt "${promptRef}" is referenced in the flow but does not exist on this instance`,
        });
      }
    }

    const now = new Date().toISOString();
    const newFlow: StoredFlow = {
      id: randomUUID(),
      name: data.metadata.name,
      description: data.metadata.description,
      graph: data.graph,
      toolRefs: data.toolRefs.filter((r): r is string => typeof r === 'string'),
      promptRefs: data.promptRefs.filter((r): r is string => typeof r === 'string'),
      createdAt: now,
      updatedAt: now,
    };

    flowStore.set(newFlow.id, newFlow);

    return { flow: newFlow, warnings };
  }

  /**
   * List all stored flows (for testing / introspection).
   */
  listFlows(): StoredFlow[] {
    return Array.from(flowStore.values());
  }

  /**
   * Get a single stored flow by ID.
   */
  getFlow(flowId: string): StoredFlow | null {
    return flowStore.get(flowId) ?? null;
  }
}

export const flowSerializer = new FlowSerializer();
