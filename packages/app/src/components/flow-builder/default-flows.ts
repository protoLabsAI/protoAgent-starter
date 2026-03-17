/**
 * default-flows.ts — Pre-built default flow definitions.
 *
 * Exports a set of default flows that can be loaded on first visit to the
 * Flow Builder page when no saved flows exist.
 *
 * Each flow conforms to the React Flow node/edge shape used throughout the
 * flow builder (FlowNodeData from nodes.tsx).
 */

import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from './nodes.js';

// ── Assistant flow ─────────────────────────────────────────────────────────────

/**
 * Default "Assistant" flow.
 *
 * Linear pipeline:
 *   preprocess → agent → tool_router → tool_execution → postprocess
 *
 * Tools:
 *   - get_weather
 *   - get_current_time
 */

export const ASSISTANT_FLOW_NODES: Node<FlowNodeData>[] = [
  {
    id: 'preprocess',
    type: 'state',
    position: { x: 300, y: 40 },
    data: {
      kind: 'state',
      label: 'Preprocess',
      description: 'Normalise and validate incoming user message',
      stateKey: 'messages',
    },
  },
  {
    id: 'agent',
    type: 'agent',
    position: { x: 300, y: 160 },
    data: {
      kind: 'agent',
      label: 'Assistant',
      description: 'Helpful AI assistant with access to weather and time tools',
      model: 'claude-3-5-haiku-20241022',
    },
  },
  {
    id: 'tool_router',
    type: 'condition',
    position: { x: 300, y: 290 },
    data: {
      kind: 'condition',
      label: 'Tool Router',
      description: 'Route to tool execution if a tool call was requested',
      condition: 'last message contains tool_use → tool_execution, else → postprocess',
    },
  },
  {
    id: 'tool_execution',
    type: 'state',
    position: { x: 100, y: 430 },
    data: {
      kind: 'state',
      label: 'Tool Execution',
      description: 'Execute the requested tool and append results to messages',
      stateKey: 'toolResults',
    },
  },
  {
    id: 'get_weather',
    type: 'tool',
    position: { x: -120, y: 560 },
    data: {
      kind: 'tool',
      label: 'get_weather',
      description: 'Fetch current weather for a location',
      toolName: 'get_weather',
    },
  },
  {
    id: 'get_current_time',
    type: 'tool',
    position: { x: 120, y: 560 },
    data: {
      kind: 'tool',
      label: 'get_current_time',
      description: 'Return the current date and time',
      toolName: 'get_current_time',
    },
  },
  {
    id: 'postprocess',
    type: 'state',
    position: { x: 500, y: 430 },
    data: {
      kind: 'state',
      label: 'Postprocess',
      description: 'Format and return the final assistant response',
      stateKey: 'finalResponse',
    },
  },
];

export const ASSISTANT_FLOW_EDGES: Edge[] = [
  { id: 'e-pre-agent', source: 'preprocess', target: 'agent', animated: true },
  { id: 'e-agent-router', source: 'agent', target: 'tool_router', animated: true },
  {
    id: 'e-router-exec',
    source: 'tool_router',
    target: 'tool_execution',
    animated: true,
    label: 'tool_use',
  },
  {
    id: 'e-router-post',
    source: 'tool_router',
    target: 'postprocess',
    animated: true,
    label: 'done',
  },
  { id: 'e-exec-weather', source: 'tool_execution', target: 'get_weather', animated: true },
  {
    id: 'e-exec-time',
    source: 'tool_execution',
    target: 'get_current_time',
    animated: true,
  },
  { id: 'e-weather-agent', source: 'get_weather', target: 'agent', animated: true },
  { id: 'e-time-agent', source: 'get_current_time', target: 'agent', animated: true },
];

// ── Registry of all default flows ─────────────────────────────────────────────

export interface DefaultFlow {
  id: string;
  name: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

export const DEFAULT_FLOWS: DefaultFlow[] = [
  {
    id: 'assistant',
    name: 'Assistant',
    nodes: ASSISTANT_FLOW_NODES,
    edges: ASSISTANT_FLOW_EDGES,
  },
];
