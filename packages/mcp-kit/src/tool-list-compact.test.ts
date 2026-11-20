// The tools/list answer says each long description once per tool (each product's docs/specs/015-api/mcp-server.md
// "Tool list size").
import { describe, expect, it } from 'vitest';
import {
  compactToolList,
  compactToolListResponse,
  isToolListCall,
  REPEAT_MIN_CHARS,
  sayDescriptionsOnce,
} from './tool-list-compact';

const LONG = 'How a rule starts. '.repeat(20);
const SHORT = 'The plan.';

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://mcp.liveexample.app/mcp', {
    method: 'POST',
    headers: { 'Content-Length': String(body.length), ...headers },
    body,
  });

describe('sayDescriptionsOnce', () => {
  it('keeps the first place a long description stands and points every repeat at it', () => {
    const schema = {
      type: 'object',
      properties: {
        changes: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'object',
                properties: {
                  op: { type: 'string', const: 'add' },
                  rule: { type: 'object', properties: { trigger: { description: LONG } } },
                },
              },
              {
                type: 'object',
                properties: {
                  op: { type: 'string', const: 'set' },
                  trigger: { description: LONG },
                },
              },
            ],
          },
        },
      },
    };
    const out = sayDescriptionsOnce(schema);
    const [add, set] = out.properties.changes.items.oneOf;
    expect(add!.properties.rule!.properties.trigger.description).toBe(LONG);
    expect(set!.properties.trigger!.description).toBe(
      'Same as "changes[](op=add).rule.trigger" above.',
    );
  });

  it('leaves short descriptions, and a schema with no repeat, as they are', () => {
    const schema = {
      type: 'object',
      properties: {
        a: { description: SHORT },
        b: { description: SHORT },
        c: { description: LONG },
      },
      required: ['a'],
    };
    expect(SHORT.length).toBeLessThan(REPEAT_MIN_CHARS);
    expect(sayDescriptionsOnce(schema)).toEqual(schema);
  });

  it('names a union member by kind or type, and a member with no constant by its place', () => {
    const member = (key: string, name: string) => ({
      type: 'object',
      properties: { [key]: { const: name }, body: { description: LONG } },
    });
    const out = sayDescriptionsOnce({
      anyOf: [member('kind', 'table'), member('type', 'note'), { description: LONG }, 'x', null],
      properties: 'not an object',
    }) as unknown as {
      anyOf: [unknown, { properties: { body: { description: string } } }, { description: string }];
    };
    expect(out.anyOf[1].properties.body.description).toBe('Same as "(kind=table).body" above.');
    expect(out.anyOf[2].description).toBe('Same as "(kind=table).body" above.');
  });

  it('reads a member whose properties hold no constant, or none at all', () => {
    const out = sayDescriptionsOnce({
      oneOf: [
        { properties: { op: { type: 'string' }, text: { description: LONG } } },
        { properties: 3 },
      ],
    });
    expect(JSON.stringify(out)).toContain(LONG);
  });
});

describe('compactToolList', () => {
  it('compacts each tool’s input and output schema on its own', () => {
    const tool = (name: string) => ({
      name,
      inputSchema: { properties: { a: { description: LONG }, b: { description: LONG } } },
      outputSchema: { properties: { c: { description: LONG }, d: { description: LONG } } },
    });
    const out = compactToolList({
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [tool('one'), tool('two'), 7] },
    });
    const tools = (out as unknown as { result: { tools: ReturnType<typeof tool>[] } }).result.tools;
    for (const listed of tools.slice(0, 2)) {
      expect(listed.inputSchema.properties.a.description).toBe(LONG);
      expect(listed.inputSchema.properties.b.description).toBe('Same as "a" above.');
      expect(listed.outputSchema.properties.d.description).toBe('Same as "c" above.');
    }
    expect(tools[2]).toBe(7);
  });

  it('hands back a tool with no schemas, and any other answer, untouched', () => {
    expect(compactToolList({ result: { tools: [{ name: 'bare' }] } })).toEqual({
      result: { tools: [{ name: 'bare' }] },
    });
    for (const body of [null, [], { error: { code: 1 } }, { result: { tools: 'none' } }])
      expect(compactToolList(body)).toBe(body);
  });
});

describe('isToolListCall', () => {
  const call = (method: string) => JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} });

  it('knows a tools/list call and leaves its body for the transport', async () => {
    const request = post(call('tools/list'));
    expect(await isToolListCall(request)).toBe(true);
    expect(await request.json()).toMatchObject({ method: 'tools/list' });
  });

  it('says no to another method, a batch, a body that is not JSON, a GET and anything large or unsized', async () => {
    expect(await isToolListCall(post(call('tools/call')))).toBe(false);
    expect(await isToolListCall(post('[]'))).toBe(false);
    expect(await isToolListCall(post('{'))).toBe(false);
    expect(await isToolListCall(new Request('https://mcp.liveexample.app/mcp'))).toBe(false);
    expect(await isToolListCall(post(call('tools/list'), { 'Content-Length': '999999' }))).toBe(
      false,
    );
    const unsized = post(call('tools/list'));
    unsized.headers.delete('Content-Length');
    expect(await isToolListCall(unsized)).toBe(false);
  });
});

describe('compactToolListResponse', () => {
  it('rewrites a JSON answer and drops the old length', async () => {
    const body = {
      result: {
        tools: [
          {
            name: 't',
            inputSchema: { properties: { a: { description: LONG }, b: { description: LONG } } },
          },
        ],
      },
    };
    const res = await compactToolListResponse(
      new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json', 'Content-Length': '1' },
      }),
    );
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Content-Length')).toBeNull();
    expect(JSON.stringify(await res.json())).toContain('Same as \\"a\\" above.');
  });

  it('passes a failure and an answer that is not JSON through', async () => {
    const failed = new Response('{}', { status: 500 });
    expect(await compactToolListResponse(failed)).toBe(failed);
    const stream = new Response('event: message');
    expect(await compactToolListResponse(stream)).toBe(stream);
  });
});
