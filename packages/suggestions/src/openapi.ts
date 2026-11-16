// What each product's OpenAPI manifest says about the canvas suggestion routes
// (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md "The api"): one wording for all four, so the
// products' docs never drift. Each manifest adds its own method, path, segment, tag and auth around these.
import { SUGGESTION_MAX_OPS, SUGGESTIONS_MAX_PER_TAB } from './suggestion';

type Entry = {
  summary: string;
  requestSchema?: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  statuses: number[];
};

const suggestion = {
  type: 'object',
  description:
    'A proposed change: its author (collab key, name, colour), its element ops, and the fingerprint each target had when it was made.',
  properties: {
    id: { type: 'string', pattern: '^sg_[a-z2-7]{10}$' },
    tabId: { type: 'string' },
    author: { type: 'object' },
    createdAt: { type: 'integer' },
    ops: { type: 'array', items: { type: 'object' } },
    base: { type: 'object' },
    conflict: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'tabId', 'author', 'createdAt', 'ops', 'base'],
};

const decision = {
  type: 'object',
  description: '`{ "all": true }` for every suggestion on the tab, or `{ "ids": [...] }`.',
  properties: {
    all: { type: 'boolean' },
    ids: { type: 'array', maxItems: SUGGESTIONS_MAX_PER_TAB, items: { type: 'string' } },
  },
};

export const SUGGESTIONS_OPENAPI: {
  list: Entry;
  submit: Entry;
  accept: Entry;
  reject: Entry;
} = {
  list: {
    summary:
      "The tab's pending suggestions, oldest first. A Participant's or an Editor's; a Viewer never sees them.",
    responseSchema: {
      type: 'object',
      properties: { suggestions: { type: 'array', items: suggestion } },
      required: ['suggestions'],
    },
    statuses: [200, 401, 403, 404, 410],
  },
  submit: {
    summary: `Suggest a change to the tab: up to ${SUGGESTION_MAX_OPS} element ops (add, update, remove), kept as a proposal until an Editor accepts or rejects it, never written to the canvas. At most ${SUGGESTIONS_MAX_PER_TAB} wait on a tab. A Participant's or an Editor's.`,
    requestSchema: {
      type: 'object',
      properties: {
        ops: { type: 'array', maxItems: SUGGESTION_MAX_OPS, items: { type: 'object' } },
      },
      required: ['ops'],
    },
    responseSchema: {
      type: 'object',
      properties: { suggestion },
      required: ['suggestion'],
    },
    statuses: [201, 400, 401, 403, 404, 409, 410, 413],
  },
  accept: {
    summary:
      "Accept suggestions as one changeset by you. One whose elements changed since it was made is a conflict: it is flagged and left, never applied. An Editor's only.",
    requestSchema: decision,
    responseSchema: {
      type: 'object',
      properties: {
        accepted: { type: 'array', items: { type: 'string' } },
        conflicts: { type: 'array', items: { type: 'object' } },
        changeset: { type: ['string', 'null'] },
      },
      required: ['accepted', 'conflicts'],
    },
    statuses: [200, 400, 401, 403, 404, 409, 410],
  },
  reject: {
    summary:
      'Reject suggestions; nothing on the canvas changes. An Editor rejects any; a Participant takes back its own.',
    requestSchema: decision,
    responseSchema: {
      type: 'object',
      properties: { rejected: { type: 'array', items: { type: 'string' } } },
      required: ['rejected'],
    },
    statuses: [200, 400, 401, 403, 404, 410],
  },
};
