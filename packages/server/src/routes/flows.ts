/**
 * Flow routes.
 *
 * Provides a REST API for managing React Flow graphs persisted as JSON files
 * in the `.flows/` directory at the project root.
 *
 * Endpoints:
 *   POST   /api/flows             → create a new flow
 *   GET    /api/flows             → list all flows
 *   GET    /api/flows/:id         → get a single flow by ID
 *   PUT    /api/flows/:id         → update an existing flow
 *   DELETE /api/flows/:id         → delete a flow
 *   GET    /api/flows/:id/export  → export a flow as a self-contained JSON document
 *   POST   /api/flows/import      → import a flow from an exported JSON document
 */

import { Router, type Request, type Response } from 'express';
import {
  createFlow,
  listFlows,
  getFlow,
  updateFlow,
  deleteFlow,
} from '../services/flow-storage.js';
import { flowSerializer } from '../services/flow-serializer.js';

const router: Router = Router();

// ─── POST / — create a new flow ───────────────────────────────────────────────

router.post('/', (req: Request, res: Response): void => {
  const { name, nodes, edges, metadata } = req.body as {
    name?: unknown;
    nodes?: unknown;
    edges?: unknown;
    metadata?: unknown;
  };

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: '"name" is required and must be a string' });
    return;
  }

  try {
    const flow = createFlow({
      name,
      nodes: Array.isArray(nodes) ? nodes : [],
      edges: Array.isArray(edges) ? edges : [],
      metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : undefined,
    });
    res.status(201).json(flow);
  } catch (err) {
    console.error('[POST /api/flows]', err);
    res.status(500).json({ error: 'Failed to create flow' });
  }
});

// ─── GET / — list all flows ───────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response): void => {
  try {
    const flows = listFlows();
    res.json(flows);
  } catch (err) {
    console.error('[GET /api/flows]', err);
    res.status(500).json({ error: 'Failed to list flows' });
  }
});

// ─── POST /import — import a flow ────────────────────────────────────────────

router.post('/import', (req: Request, res: Response): void => {
  try {
    const result = flowSerializer.importFlow(req.body);
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    res.status(400).json({ error: message });
  }
});

// ─── GET /:id/export — export a flow ─────────────────────────────────────────

router.get('/:id/export', (req: Request, res: Response): void => {
  const flowId = String(req.params['id'] ?? '');
  if (!flowId) {
    res.status(400).json({ error: 'Flow ID is required' });
    return;
  }

  const exported = flowSerializer.exportFlow(flowId);
  if (!exported) {
    res.status(404).json({ error: `Flow "${flowId}" not found` });
    return;
  }

  res.json(exported);
});

// ─── GET /:id — get a single flow ─────────────────────────────────────────────

router.get('/:id', (req: Request, res: Response): void => {
  const id = String(req.params['id'] ?? '');
  if (!id) {
    res.status(400).json({ error: 'Invalid flow ID' });
    return;
  }

  try {
    const flow = getFlow(id);
    if (!flow) {
      res.status(404).json({ error: `Flow "${id}" not found` });
      return;
    }
    res.json(flow);
  } catch (err) {
    console.error(`[GET /api/flows/${id}]`, err);
    res.status(500).json({ error: 'Failed to retrieve flow' });
  }
});

// ─── PUT /:id — update a flow ─────────────────────────────────────────────────

router.put('/:id', (req: Request, res: Response): void => {
  const id = String(req.params['id'] ?? '');
  if (!id) {
    res.status(400).json({ error: 'Invalid flow ID' });
    return;
  }

  const { name, nodes, edges, metadata } = req.body as {
    name?: unknown;
    nodes?: unknown;
    edges?: unknown;
    metadata?: unknown;
  };

  try {
    const updated = updateFlow(id, {
      name: typeof name === 'string' ? name : undefined,
      nodes: Array.isArray(nodes) ? nodes : undefined,
      edges: Array.isArray(edges) ? edges : undefined,
      metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: `Flow "${id}" not found` });
      return;
    }

    res.json(updated);
  } catch (err) {
    console.error(`[PUT /api/flows/${id}]`, err);
    res.status(500).json({ error: 'Failed to update flow' });
  }
});

// ─── DELETE /:id — delete a flow ──────────────────────────────────────────────

router.delete('/:id', (req: Request, res: Response): void => {
  const id = String(req.params['id'] ?? '');
  if (!id) {
    res.status(400).json({ error: 'Invalid flow ID' });
    return;
  }

  try {
    const deleted = deleteFlow(id);
    if (!deleted) {
      res.status(404).json({ error: `Flow "${id}" not found` });
      return;
    }
    res.json({ deleted: true, id });
  } catch (err) {
    console.error(`[DELETE /api/flows/${id}]`, err);
    res.status(500).json({ error: 'Failed to delete flow' });
  }
});

export default router;
