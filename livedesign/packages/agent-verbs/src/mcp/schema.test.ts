import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NAME_MAX_LENGTH } from '@livedesign/design';
import {
  addTabShape,
  createDesignShape,
  createDesignTab,
  elementSchemaDoc,
  findDesignsShape,
  readDesignShape,
  renameDesignShape,
  SERVER_INSTRUCTIONS,
  updateDesignShape,
} from './schema';
import { resolveTemplate } from '@livedesign/templates';
import { changeComponentsShape } from './components-schema';

describe('elementSchemaDoc', () => {
  it('lists element types, the pinned-arrow convention, and the no-colour rule', () => {
    const doc = elementSchemaDoc();
    expect(doc).toContain('shape');
    expect(doc).toContain('arrow');
    expect(doc).toContain('pinned');
    expect(doc).toContain('"e"'.replace(/"/g, '')); // anchor 'e' from packages/design
    expect(doc).toContain('Do NOT set colours');
  });
});

describe('tool input shapes', () => {
  it('find: optional query, bounded limit', () => {
    const s = z.object(findDesignsShape);
    expect(s.parse({}).query).toBeUndefined();
    expect(() => s.parse({ limit: 100 })).toThrow();
  });

  it('create: accepts a tabs[] array or a single tab alias', () => {
    const s = z.object(createDesignShape);
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
    const c = z.object(createDesignShape);
    const viaTemplate = c.parse({ name: 'x', tabs: [{ name: 'Board', template: 'logo-design' }] });
    expect(viaTemplate.tabs?.[0]?.template).toBe('logo-design');
    expect(viaTemplate.tabs?.[0]?.elements).toBeUndefined();
    const a = z.object(addTabShape);
    expect(a.parse({ designId: 'd', name: 'Board', template: 'logo-design' }).template).toBe(
      'logo-design',
    );
    // Kind validity is a runtime check against the shared catalogue
    // (resolveTemplate in tools.ts), not a schema enum, so an arbitrary
    // string still parses here.
    expect(a.parse({ designId: 'd', name: 'Board', template: 'nope' }).template).toBe('nope');
  });

  it('add_tab: requires designId + name + elements', () => {
    const s = z.object(addTabShape);
    expect(() => s.parse({ name: 't', elements: [] })).toThrow(); // missing designId
    const ok = s.parse({ designId: 'd', name: 'Detail', elements: [], layout: 'preserve' });
    expect(ok.designId).toBe('d');
  });

  it('update: mode enum + optional ops', () => {
    const s = z.object(updateDesignShape);
    expect(() => s.parse({ designId: 'd', mode: 'nope' })).toThrow();
    const ok = s.parse({
      designId: 'd',
      mode: 'ops',
      ops: [{ op: 'remove', elementId: 'x' }],
    });
    expect(ok.mode).toBe('ops');
  });

  it('create/update accept an optional layout enum', () => {
    const c = z.object(createDesignShape);
    expect(
      c.parse({ name: 'x', tabs: [{ name: 't', elements: [] }], layout: 'preserve' }).layout,
    ).toBe('preserve');
    expect(() =>
      c.parse({ name: 'x', tabs: [{ name: 't', elements: [] }], layout: 'nope' }),
    ).toThrow();
    const u = z.object(updateDesignShape);
    expect(u.parse({ designId: 'd', mode: 'replace', elements: [], layout: 'auto' }).layout).toBe(
      'auto',
    );
  });
});

// The name cap (docs/specs/006-design/name-length.md): the tools shorten a
// name with the shared truncateName, so what they report back is what the api
// stores, and the advertised JSON Schema states the cap.
describe('name fields', () => {
  const long = 'Quarterly platform migration plan for the payments team and friends';
  const capped = 'Quarterly platform migration plan for the payments team…';

  it('create shortens the design name and every tab name', () => {
    const parsed = z.object(createDesignShape).parse({
      name: long,
      tabs: [{ name: long, elements: [] }],
      tab: { name: long, elements: [] },
    });
    expect(parsed.name).toBe(capped);
    expect(parsed.tabs?.[0]?.name).toBe(capped);
    // The single-tab alias is checked by the tool against the same tab shape, which caps it alike.
    expect(createDesignTab.parse(parsed.tab).name).toBe(capped);
  });

  it('add_tab and rename shorten the name', () => {
    expect(z.object(addTabShape).parse({ designId: 'd', name: long }).name).toBe(capped);
    expect(z.object(renameDesignShape).parse({ designId: 'd', name: long }).name).toBe(capped);
  });

  it('leaves a fitting name as it is, whitespace collapsed', () => {
    expect(z.object(addTabShape).parse({ designId: 'd', name: ' Q3\n plan ' }).name).toBe(
      'Q3 plan',
    );
  });

  it('rename still refuses an empty name', () => {
    expect(() => z.object(renameDesignShape).parse({ designId: 'd', name: '' })).toThrow();
  });

  it('advertises the cap in the input JSON Schema', () => {
    for (const shape of [createDesignShape, addTabShape, renameDesignShape]) {
      const name = z.toJSONSchema(z.object(shape), { io: 'input' }).properties?.name;
      expect(typeof name === 'object' && name.type).toBe('string');
      expect(typeof name === 'object' && name.description).toContain(
        `at most ${NAME_MAX_LENGTH} characters`,
      );
    }
  });
});

// The benchmark's F1: the instructions once gave "retro" as an example, and models passed it as a template kind.
describe('SERVER_INSTRUCTIONS template examples', () => {
  it('names only kinds create_design takes', () => {
    const list = /the other templates \(([^)]*)\)/.exec(SERVER_INSTRUCTIONS)?.[1] ?? '';
    const examples = list
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter((s) => s && s !== '...');
    expect(examples.length).toBeGreaterThan(3);
    for (const kind of examples) expect(resolveTemplate(kind), kind).not.toBeNull();
    // The blank templates it starts each kind of design from.
    const blanks = [...SERVER_INSTRUCTIONS.matchAll(/"(blank-[a-z-]+)"/g)].map((m) => m[1]!);
    expect(blanks.length).toBeGreaterThan(3);
    for (const kind of blanks) expect(resolveTemplate(kind), kind).not.toBeNull();
  });
});

describe('change_components', () => {
  it('takes make, patch or detach, each bounded', () => {
    const s = z.object(changeComponentsShape);
    expect(s.parse({ designId: 'd', make: { elementIds: ['a'] } }).make?.elementIds).toEqual(['a']);
    expect(() => s.parse({ designId: 'd', make: { elementIds: [] } })).toThrow();
    expect(s.parse({ designId: 'd', patch: { componentId: 'c', remove: ['x'] } }).patch).toEqual({
      componentId: 'c',
      remove: ['x'],
    });
    expect(() => s.parse({ designId: 'd', detach: { instance: '' } })).toThrow();
  });

  it('read_design takes the components view, and the element format names instances', () => {
    expect(z.object(readDesignShape).parse({ designId: 'd', view: 'components' }).view).toBe(
      'components',
    );
    expect(elementSchemaDoc()).toContain('shape "instance"');
    expect(updateDesignShape.edits.description).toContain('detach <instance>');
  });
});
