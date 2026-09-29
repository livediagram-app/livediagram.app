import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NAME_MAX_LENGTH } from '@livediagram/document';
import {
  addTabShape,
  createDocumentShape,
  elementSchemaDoc,
  findDocumentsShape,
  renameDocumentShape,
  updateDocumentShape,
} from './schema';

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
    expect(() => s.parse({ name: 't', elements: [] })).toThrow(); // missing diagramId
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

  it('create shortens the diagram name and every tab name', () => {
    const parsed = z.object(createDocumentShape).parse({
      name: long,
      tabs: [{ name: long, elements: [] }],
      tab: { name: long, elements: [] },
    });
    expect(parsed.name).toBe(capped);
    expect(parsed.tabs?.[0]?.name).toBe(capped);
    expect(parsed.tab?.name).toBe(capped);
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
