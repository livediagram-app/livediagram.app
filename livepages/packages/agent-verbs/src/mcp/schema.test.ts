import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  GRAPH_LAYOUT_MAX_EDGES,
  GRAPH_LAYOUT_MAX_NODES,
  NAME_MAX_LENGTH,
} from '@livepages/document';
import {
  addTabShape,
  createDocumentShape,
  createDocumentTab,
  elementSchemaDoc,
  findDocumentsShape,
  renameDocumentShape,
  SERVER_INSTRUCTIONS,
  updateDocumentShape,
} from './schema';
import { resolveTemplate } from '@livepages/templates';

describe('elementSchemaDoc', () => {
  it('lists element types, the pinned-arrow convention, and the no-colour rule', () => {
    const doc = elementSchemaDoc();
    expect(doc).toContain('shape');
    expect(doc).toContain('arrow');
    expect(doc).toContain('pinned');
    expect(doc).toContain('"e"'.replace(/"/g, '')); // anchor 'e' from packages/document
    expect(doc).toContain('Do NOT set colours');
  });
});

describe('tool input shapes', () => {
  it('find: optional query, bounded limit', () => {
    const s = z.object(findDocumentsShape);
    expect(s.parse({}).query).toBeUndefined();
    expect(() => s.parse({ limit: 100 })).toThrow();
  });

  it('create: accepts a tabs[] array or a single tab alias', () => {
    const s = z.object(createDocumentShape);
    expect(() => s.parse({ name: 'x', tabs: [] })).toThrow(); // min 1 when tabs is given
    const multi = s.parse({
      name: 'x',
      tabs: [
        { name: 'Overview', elements: [{ id: 'a', type: 'shape' }] },
        { name: 'Detail', elements: [] },
      ],
    });
    expect(multi.tabs).toHaveLength(2);
    // The `tab` alias (stale-cache compatibility) parses too.
    expect(s.parse({ name: 'x', tab: { name: 'a', elements: [] } }).tab).toBeTruthy();
  });

  it('create/add_tab: a tab may pass template instead of elements', () => {
    const c = z.object(createDocumentShape);
    const viaTemplate = c.parse({ name: 'x', tabs: [{ name: 'Board', template: 'kanban' }] });
    expect(viaTemplate.tabs?.[0]?.template).toBe('kanban');
    expect(viaTemplate.tabs?.[0]?.elements).toBeUndefined();
    const a = z.object(addTabShape);
    expect(a.parse({ documentId: 'd', name: 'Board', template: 'kanban' }).template).toBe('kanban');
    // Kind validity is a runtime check against the shared catalogue
    // (resolveTemplate in tools.ts), not a schema enum, so an arbitrary
    // string still parses here.
    expect(a.parse({ documentId: 'd', name: 'Board', template: 'nope' }).template).toBe('nope');
  });

  it('add_tab: requires documentId + name + elements', () => {
    const s = z.object(addTabShape);
    expect(() => s.parse({ name: 't', elements: [] })).toThrow(); // missing documentId
    const ok = s.parse({ documentId: 'd', name: 'Detail', elements: [], layout: 'preserve' });
    expect(ok.documentId).toBe('d');
  });

  it('update: mode enum + optional ops', () => {
    const s = z.object(updateDocumentShape);
    expect(() => s.parse({ documentId: 'd', mode: 'nope' })).toThrow();
    const ok = s.parse({
      documentId: 'd',
      mode: 'ops',
      ops: [{ op: 'remove', elementId: 'x' }],
    });
    expect(ok.mode).toBe('ops');
  });

  it('create/update accept an optional layout enum', () => {
    const c = z.object(createDocumentShape);
    expect(
      c.parse({ name: 'x', tabs: [{ name: 't', elements: [] }], layout: 'preserve' }).layout,
    ).toBe('preserve');
    expect(() =>
      c.parse({ name: 'x', tabs: [{ name: 't', elements: [] }], layout: 'nope' }),
    ).toThrow();
    const u = z.object(updateDocumentShape);
    expect(u.parse({ documentId: 'd', mode: 'replace', elements: [], layout: 'auto' }).layout).toBe(
      'auto',
    );
  });
});

// The name cap (docs/specs/006-document/name-length.md): the tools shorten a
// name with the shared truncateName, so what they report back is what the api
// stores, and the advertised JSON Schema states the cap.
describe('name fields', () => {
  const long = 'Quarterly platform migration plan for the payments team and friends';
  const capped = 'Quarterly platform migration plan for the payments team…';

  it('create shortens the document name and every tab name', () => {
    const parsed = z.object(createDocumentShape).parse({
      name: long,
      tabs: [{ name: long, elements: [] }],
      tab: { name: long, elements: [] },
    });
    expect(parsed.name).toBe(capped);
    expect(parsed.tabs?.[0]?.name).toBe(capped);
    // The single-tab alias is checked by the tool against the same tab shape, which caps it alike.
    expect(createDocumentTab.parse(parsed.tab).name).toBe(capped);
  });

  it('add_tab and rename shorten the name', () => {
    expect(z.object(addTabShape).parse({ documentId: 'd', name: long }).name).toBe(capped);
    expect(z.object(renameDocumentShape).parse({ documentId: 'd', name: long }).name).toBe(capped);
  });

  it('leaves a fitting name as it is, whitespace collapsed', () => {
    expect(z.object(addTabShape).parse({ documentId: 'd', name: ' Q3\n plan ' }).name).toBe(
      'Q3 plan',
    );
  });

  it('rename still refuses an empty name', () => {
    expect(() => z.object(renameDocumentShape).parse({ documentId: 'd', name: '' })).toThrow();
  });

  it('advertises the cap in the input JSON Schema', () => {
    for (const shape of [createDocumentShape, addTabShape, renameDocumentShape]) {
      const name = z.toJSONSchema(z.object(shape), { io: 'input' }).properties?.name;
      expect(typeof name === 'object' && name.type).toBe('string');
      expect(typeof name === 'object' && name.description).toContain(
        `at most ${NAME_MAX_LENGTH} characters`,
      );
    }
  });
});

// The graph input is held to the layout's caps (docs/specs/015-api/mcp-server.md §4.7): a model
// asking for a larger graph hears so from the schema rather than stalling the worker on the layout.
describe('graph input caps', () => {
  const s = z.object(addTabShape);
  const nodes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `n${i}` }));
  const edges = (n: number) => Array.from({ length: n }, () => ({ from: 'n0', to: 'n1' }));

  it('accepts a graph at the caps', () => {
    expect(() =>
      s.parse({
        documentId: 'd',
        name: 't',
        graph: { nodes: nodes(GRAPH_LAYOUT_MAX_NODES), edges: edges(GRAPH_LAYOUT_MAX_EDGES) },
      }),
    ).not.toThrow();
  });

  it('refuses one node or one edge more', () => {
    expect(() =>
      s.parse({
        documentId: 'd',
        name: 't',
        graph: { nodes: nodes(GRAPH_LAYOUT_MAX_NODES + 1), edges: [] },
      }),
    ).toThrow();
    expect(() =>
      s.parse({
        documentId: 'd',
        name: 't',
        graph: { nodes: nodes(2), edges: edges(GRAPH_LAYOUT_MAX_EDGES + 1) },
      }),
    ).toThrow();
  });
});

// The benchmark's F1: the instructions once gave "retro" as an example, and models passed it as a template kind.
// A model read "flowchart roles toned (start, end, decision)" as the node's `role` field, which draws a person card:
// the instructions name a flowchart step's kind by its shape, and say what `role` is for.
describe('SERVER_INSTRUCTIONS on flowchart steps', () => {
  it('names a step by its shape and keeps "role" for a person', () => {
    expect(SERVER_INSTRUCTIONS).not.toMatch(/flowchart roles/);
    expect(SERVER_INSTRUCTIONS).toMatch(/flowchart steps toned by their "shape"/);
    expect(SERVER_INSTRUCTIONS).toMatch(/"role" is a person's job title/);
  });
});

describe('SERVER_INSTRUCTIONS template examples', () => {
  it('names only kinds create_document takes', () => {
    const list = /the other templates \(([^)]*)\)/.exec(SERVER_INSTRUCTIONS)?.[1] ?? '';
    const examples = list
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter((s) => s && s !== '...');
    expect(examples.length).toBeGreaterThan(3);
    for (const kind of examples) expect(resolveTemplate(kind), kind).not.toBeNull();
    // The blank templates it starts each kind of document from.
    const blanks = [...SERVER_INSTRUCTIONS.matchAll(/"(blank-[a-z-]+)"/g)].map((m) => m[1]!);
    expect(blanks.length).toBeGreaterThan(3);
    for (const kind of blanks) expect(resolveTemplate(kind), kind).not.toBeNull();
  });
});
