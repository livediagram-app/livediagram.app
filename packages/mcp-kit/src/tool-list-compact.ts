// A tools/list answer with each long description said once per tool (each product's docs/specs/015-api/mcp-server.md
// "Tool list size"). A schema built from shared parts repeats their descriptions wherever the part is used: a rule's
// trigger under both `add` and `set`, a question under `questions` and under each section. Every client pays for the
// whole list in each session, so a repeat becomes a pointer to the first place the text stands. Only the listing
// changes: the SDK validates a call against the tool's own schema, never this JSON.

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

/** One schema with every repeat of a long description replaced by a pointer to its first place. */
export function sayDescriptionsOnce<T>(schema: T): T {
  const firstAt = new Map<string, string>();
  const walk = (node: Json, path: string): Json => {
    if (Array.isArray(node)) return node.map((entry) => walk(entry, path));
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
      } else if (key === 'properties' && isObject(value)) {
        out[key] = Object.fromEntries(
          Object.entries(value).map(([name, property]) => [
            name,
            walk(property, path ? `${path}.${name}` : name),
          ]),
        );
      } else if (key === 'items') {
        out[key] = walk(value, `${path}[]`);
      } else if ((key === 'oneOf' || key === 'anyOf') && Array.isArray(value)) {
        out[key] = value.map((member) => {
          const variant = isObject(member) ? variantOf(member) : null;
          return walk(member, variant ? `${path}(${variant})` : path);
        });
      } else {
        out[key] = walk(value, path);
      }
    }
    return out;
  };
  return walk(schema as Json, '') as T;
}

/** A JSON-RPC tools/list answer, its tools' schemas compacted; anything else is handed back as it came. */
export function compactToolList<T>(given: T): T {
  const body = given as Json;
  if (!isObject(body) || !isObject(body.result) || !Array.isArray(body.result.tools)) return given;
  const tools = body.result.tools.map((tool) => {
    if (!isObject(tool)) return tool;
    const compact = { ...tool };
    if (tool.inputSchema !== undefined) compact.inputSchema = sayDescriptionsOnce(tool.inputSchema);
    if (tool.outputSchema !== undefined)
      compact.outputSchema = sayDescriptionsOnce(tool.outputSchema);
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
