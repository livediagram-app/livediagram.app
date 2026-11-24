// A tools/list answer with each long description said once per tool (each product's docs/specs/015-api/mcp-server.md
// "Tool list size"). A schema built from shared parts repeats their descriptions wherever the part is used: a rule's
// trigger under both `add` and `set`, a question under `questions` and under each section. Every client pays for the
// whole list in each session, so a repeat becomes a pointer to the first place the text stands. A short description
// said again of a property of the same name (`tabId` under each of a tool's ops) is left out of the repeats: the
// first already said what that property is, and a pointer would be longer than the words. Only the listing changes:
// the SDK validates a call against the tool's own schema, never this JSON. A tuple is said as a plain array too
// (`untuple`), so a client that hands the list to the Claude API isn't refused.

// The shortest description worth pointing at: under this a pointer saves little and reads worse.
export const REPEAT_MIN_CHARS = 200;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isObject = (value: Json | undefined): value is { [key: string]: Json } =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A union member's own name, read from the constant it is told apart by ({"op": {"const": "add"}}).
function variantOf(schema: { [key: string]: Json }): string | null {
  const properties = schema.properties;
  if (!isObject(properties)) return null;
  for (const key of ['op', 'kind', 'type']) {
    const property = properties[key];
    if (isObject(property) && typeof property.const === 'string') return `${key}=${property.const}`;
  }
  return null;
}

/**
 * A schema with every tuple (zod's `z.tuple`: `items` as an array, `additionalItems`) said as a plain array of one
 * item schema, which every JSON Schema draft reads alike. The Claude API takes JSON Schema 2020-12 only, where a
 * draft-07 tuple is invalid and the whole tool list is refused. Positions alike (a two-stop gradient) keep their one
 * schema; positions that differ become `anyOf`. The length stays exact through minItems and maxItems.
 */
export function untuple<T>(schema: T): T {
  const walk = (node: Json): Json => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isObject(node)) return node;
    const out: { [key: string]: Json } = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'additionalItems' && Array.isArray(node.items)) continue;
      out[key] = walk(value);
    }
    if (Array.isArray(node.items)) {
      const positions = (out.items as Json[]).filter((p) => p !== undefined);
      const distinct = [...new Map(positions.map((p) => [JSON.stringify(p), p])).values()];
      out.items = distinct.length === 1 ? distinct[0]! : { anyOf: distinct };
      out.minItems ??= positions.length;
      if (node.additionalItems === false || node.additionalItems === undefined)
        out.maxItems ??= positions.length;
    }
    return out;
  };
  return walk(schema as Json) as T;
}

/**
 * One schema with every repeat of a long description replaced by a pointer to its first place, and every repeat of a
 * short one left out where it describes a property of the same name as the first.
 */
export function sayDescriptionsOnce<T>(schema: T): T {
  const firstAt = new Map<string, string>();
  // Short descriptions already said, by the property they describe and their words.
  const said = new Set<string>();
  // `name`: the property this node is the schema of, null for anything else (an array's items, a union member).
  const walk = (node: Json, path: string, name: string | null): Json => {
    if (Array.isArray(node)) return node.map((entry) => walk(entry, path, name));
    if (!isObject(node)) return node;
    const out: { [key: string]: Json } = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'description' && typeof value === 'string' && value.length >= REPEAT_MIN_CHARS) {
        const first = firstAt.get(value);
        if (first !== undefined && first !== path) {
          out[key] = `Same as "${first}" above.`;
          continue;
        }
        firstAt.set(value, path);
        out[key] = value;
      } else if (key === 'description' && typeof value === 'string' && name !== null) {
        const words = `${name}\u0000${value}`;
        if (said.has(words)) continue;
        said.add(words);
        out[key] = value;
      } else if (key === 'properties' && isObject(value)) {
        out[key] = Object.fromEntries(
          Object.entries(value).map(([property, given]) => [
            property,
            walk(given, path ? `${path}.${property}` : property, property),
          ]),
        );
      } else if (key === 'items') {
        out[key] = walk(value, `${path}[]`, null);
      } else if ((key === 'oneOf' || key === 'anyOf') && Array.isArray(value)) {
        out[key] = value.map((member) => {
          const variant = isObject(member) ? variantOf(member) : null;
          return walk(member, variant ? `${path}(${variant})` : path, null);
        });
      } else {
        out[key] = walk(value, path, null);
      }
    }
    return out;
  };
  return walk(schema as Json, '', null) as T;
}

// What an output schema keeps of a nested schema in the listing: what kind of value it is, never what is inside it.
const KIND_KEYS = ['type', 'enum', 'const'] as const;
const kindOf = (node: Json | undefined): { [key: string]: Json } => {
  if (!isObject(node)) return {};
  const out: { [key: string]: Json } = {};
  for (const key of KIND_KEYS) if (node[key] !== undefined) out[key] = node[key];
  return out;
};

// One top-level property of an output schema, shallow: its kind, its description, an array's item kind and a union's
// member kinds. Its own properties, and anything a $ref points at, are left out.
function shallowProperty(node: Json): Json {
  if (!isObject(node)) return node;
  const out = kindOf(node);
  if (typeof node.description === 'string') out.description = node.description;
  if (node.items !== undefined) out.items = kindOf(node.items);
  for (const key of ['anyOf', 'oneOf'] as const) {
    const members = node[key];
    if (Array.isArray(members)) out[key] = members.map(kindOf);
  }
  return out;
}

/**
 * An output schema as the listing shows it (each product's docs/specs/015-api/mcp-server.md §4.18 "Output schemas,
 * shallow in the listing"): its top level whole (each property's name, kind and description, and which are
 * required), everything under a property's own fields left out. Every result the full schema accepts, this one
 * accepts, so a client validating structuredContent against the listing still passes; the server still checks each
 * result against the full schema.
 */
export function shallowOutputSchema<T>(schema: T): T {
  const node = schema as Json;
  if (!isObject(node)) return schema;
  const out: { [key: string]: Json } = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === '$defs' || key === 'definitions') continue;
    out[key] =
      key === 'properties' && isObject(value)
        ? Object.fromEntries(Object.entries(value).map(([name, v]) => [name, shallowProperty(v)]))
        : value;
  }
  return out as T;
}

/** A JSON-RPC tools/list answer, its tools' schemas compacted; anything else is handed back as it came. */
export function compactToolList<T>(given: T): T {
  const body = given as Json;
  if (!isObject(body) || !isObject(body.result) || !Array.isArray(body.result.tools)) return given;
  const tools = body.result.tools.map((tool) => {
    if (!isObject(tool)) return tool;
    const compact = { ...tool };
    if (tool.inputSchema !== undefined)
      compact.inputSchema = sayDescriptionsOnce(untuple(tool.inputSchema));
    if (tool.outputSchema !== undefined)
      compact.outputSchema = sayDescriptionsOnce(shallowOutputSchema(tool.outputSchema));
    return compact;
  });
  return { ...body, result: { ...body.result, tools } } as T;
}

// The largest request read to see whether it lists tools: a tools/list call is a few dozen bytes, and nothing larger
// (an upload) is ever copied to find out.
const LIST_CALL_MAX_BYTES = 2048;

/** Whether this request is one tools/list call, read from a copy so the transport still gets its body. */
export async function isToolListCall(request: Request): Promise<boolean> {
  const length = Number(request.headers.get('Content-Length'));
  if (request.method !== 'POST' || !(length > 0 && length <= LIST_CALL_MAX_BYTES)) return false;
  try {
    const call = await request.clone().json<Json>();
    return isObject(call) && call.method === 'tools/list';
  } catch {
    return false;
  }
}

/** The transport's answer to a tools/list call, compacted; an answer that is not JSON passes through. */
export async function compactToolListResponse(response: Response): Promise<Response> {
  if (!response.ok) return response;
  let body: Json;
  try {
    body = await response.clone().json<Json>();
  } catch {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  return new Response(JSON.stringify(compactToolList(body)), { status: response.status, headers });
}
