/**
 * Tools routes.
 *
 * Exposes the registered SharedTools from the ToolRegistry as a REST endpoint.
 *
 * Endpoints:
 *   GET /api/tools  → list all registered tools with their full schema definitions
 */

import { Router, type Request, type Response } from 'express';
import { zodToJsonSchema as zodToJsonSchemaLib } from 'zod-to-json-schema';
import { registry } from '../tools/registry.js';

const router: Router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a Zod schema to a plain JSON Schema object.
 *
 * Supports both native Zod v4 `toJSONSchema()` and the `zod-to-json-schema`
 * library fallback, mirroring the pattern used in the registry.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodToJsonSchema(zodSchema: any): Record<string, unknown> {
  const hasToJSONSchema =
    typeof zodSchema === 'object' &&
    zodSchema !== null &&
    'toJSONSchema' in zodSchema &&
    typeof zodSchema.toJSONSchema === 'function';

  if (hasToJSONSchema) {
    return (zodSchema as { toJSONSchema(): Record<string, unknown> }).toJSONSchema();
  }

  return zodToJsonSchemaLib(zodSchema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
}

// ─── GET / — list all registered tools ───────────────────────────────────────

router.get('/', (_req: Request, res: Response): void => {
  const tools = registry.listTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema),
    outputSchema: zodToJsonSchema(tool.outputSchema),
    metadata: tool.metadata ?? null,
  }));

  res.json(tools);
});

export default router;
