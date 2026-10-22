import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NAME_MAX_LENGTH } from '@liveplanner/project';
import {
  addTabShape,
  createProjectShape,
  createProjectTab,
  elementSchemaDoc,
  findProjectsShape,
  renameProjectShape,
  SERVER_INSTRUCTIONS,
  updateProjectShape,
} from './schema';
import { resolveTemplate } from '@liveplanner/templates';

describe('elementSchemaDoc', () => {
  it('lists the elements a tab holds, with their fields, and no diagram kind', () => {
    const doc = elementSchemaDoc();
    for (const kind of [
      'plan-board',
      'plan-sheet',
      'plan-view',
      'bar-chart',
      'line-chart',
      'pie-chart',
    ])
      expect(doc).toContain(`shape "${kind}"`);
    expect(doc).toContain('"planView"');
    expect(doc).toContain('"chartSource"');
    for (const word of ['arrow', 'sticky', 'square', 'freehand', 'sankey', 'mermaid'])
      expect(doc.toLowerCase()).not.toContain(word);
  });
});

describe('the inline element format', () => {
  it('names only the Plan kinds, on every element argument', () => {
    const schema = z.toJSONSchema(z.object(createProjectShape), { io: 'input' });
    const text = JSON.stringify(schema);
    expect(text).toContain('plan-view');
    for (const word of ['sticky', 'freehand', 'sankey', 'right-of', 'connect', 'layout'])
      expect(text).not.toContain(word);
  });
});

describe('tool input shapes', () => {
  it('find: optional query, bounded limit', () => {
    const s = z.object(findProjectsShape);
    expect(s.parse({}).query).toBeUndefined();
    expect(() => s.parse({ limit: 100 })).toThrow();
  });

  it('create: accepts a tabs[] array or a single tab alias', () => {
    const s = z.object(createProjectShape);
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
    const c = z.object(createProjectShape);
    const viaTemplate = c.parse({ name: 'x', tabs: [{ name: 'Board', template: 'kanban' }] });
    expect(viaTemplate.tabs?.[0]?.template).toBe('kanban');
    expect(viaTemplate.tabs?.[0]?.elements).toBeUndefined();
    const a = z.object(addTabShape);
    expect(a.parse({ projectId: 'd', name: 'Board', template: 'kanban' }).template).toBe('kanban');
    // Kind validity is a runtime check against the shared catalogue
    // (resolveTemplate in tools.ts), not a schema enum, so an arbitrary
    // string still parses here.
    expect(a.parse({ projectId: 'd', name: 'Board', template: 'nope' }).template).toBe('nope');
  });

  it('add_tab: requires projectId + name + elements', () => {
    const s = z.object(addTabShape);
    expect(() => s.parse({ name: 't', elements: [] })).toThrow(); // missing projectId
    const ok = s.parse({ projectId: 'd', name: 'Detail', elements: [] });
    expect(ok.projectId).toBe('d');
  });

  it('update: mode enum + optional ops', () => {
    const s = z.object(updateProjectShape);
    expect(() => s.parse({ projectId: 'd', mode: 'nope' })).toThrow();
    const ok = s.parse({
      projectId: 'd',
      mode: 'ops',
      ops: [{ op: 'remove', elementId: 'x' }],
    });
    expect(ok.mode).toBe('ops');
  });
});

// The name cap (docs/specs/006-project/name-length.md): the tools shorten a
// name with the shared truncateName, so what they report back is what the api
// stores, and the advertised JSON Schema states the cap.
describe('name fields', () => {
  const long = 'Quarterly platform migration plan for the payments team and friends';
  const capped = 'Quarterly platform migration plan for the payments team…';

  it('create shortens the project name and every tab name', () => {
    const parsed = z.object(createProjectShape).parse({
      name: long,
      tabs: [{ name: long, elements: [] }],
      tab: { name: long, elements: [] },
    });
    expect(parsed.name).toBe(capped);
    expect(parsed.tabs?.[0]?.name).toBe(capped);
    // The single-tab alias is checked by the tool against the same tab shape, which caps it alike.
    expect(createProjectTab.parse(parsed.tab).name).toBe(capped);
  });

  it('add_tab and rename shorten the name', () => {
    expect(z.object(addTabShape).parse({ projectId: 'd', name: long }).name).toBe(capped);
    expect(z.object(renameProjectShape).parse({ projectId: 'd', name: long }).name).toBe(capped);
  });

  it('leaves a fitting name as it is, whitespace collapsed', () => {
    expect(z.object(addTabShape).parse({ projectId: 'd', name: ' Q3\n plan ' }).name).toBe(
      'Q3 plan',
    );
  });

  it('rename still refuses an empty name', () => {
    expect(() => z.object(renameProjectShape).parse({ projectId: 'd', name: '' })).toThrow();
  });

  it('advertises the cap in the input JSON Schema', () => {
    for (const shape of [createProjectShape, addTabShape, renameProjectShape]) {
      const name = z.toJSONSchema(z.object(shape), { io: 'input' }).properties?.name;
      expect(typeof name === 'object' && name.type).toBe('string');
      expect(typeof name === 'object' && name.description).toContain(
        `at most ${NAME_MAX_LENGTH} characters`,
      );
    }
  });
});

describe('SERVER_INSTRUCTIONS template examples', () => {
  it('names only kinds create_project takes', () => {
    const list =
      /list_templates lists the Plan templates \(([^)]*)\)/.exec(SERVER_INSTRUCTIONS)?.[1] ?? '';
    const examples = list
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter((s) => s && s !== '...');
    expect(examples.length).toBeGreaterThan(3);
    for (const kind of examples) expect(resolveTemplate(kind), kind).not.toBeNull();
  });
});
