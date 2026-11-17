import { describe, expect, it } from 'vitest';
import { layoutGraph, type GraphInput } from './graph-input';
import { C4_LOOK } from './c4-look';
import { C4_DESCRIPTION_MAX } from './graph-c4';
import type { Element } from './index';

// Graph input's c4 style (docs/specs/015-api/mcp-server.md §4.7 `c4`): each level of the C4 model drawn from a plain
// graph, with no coordinates.

let n = 0;
const lay = (g: GraphInput) => layoutGraph(g, { makeEdgeId: () => `e${n++}` });
type Shape = Extract<Element, { type: 'shape' }>;
const shape = (els: Element[], id: string) => els.find((e) => e.id === id) as Shape;
const texts = (els: Element[]) =>
  els.filter((e) => e.type === 'text').map((e) => (e as { label?: string }).label);

const context: GraphInput = {
  style: 'c4',
  title: 'Internet banking · system context',
  nodes: [
    {
      id: 'cust',
      label: 'Personal banking customer',
      shape: 'actor',
      description: 'Has accounts.',
    },
    { id: 'ibs', label: 'Internet banking system', description: 'Views accounts, pays.' },
    { id: 'mail', label: 'E-mail system', c4Kind: 'external', tech: 'Microsoft Exchange' },
  ],
  edges: [
    { from: 'cust', to: 'ibs', label: 'Uses' },
    { from: 'ibs', to: 'mail', label: 'Sends e-mail · SMTP' },
  ],
};

const container: GraphInput = {
  style: 'c4',
  nodes: [
    { id: 'cust', label: 'Customer', c4Kind: 'person' },
    {
      id: 'web',
      label: 'Web app',
      group: 'ibs',
      tech: 'Angular',
      description: 'Banking in the browser.',
    },
    { id: 'api', label: 'API application', group: 'ibs', tech: 'Java' },
    {
      id: 'db',
      label: 'Database',
      group: 'ibs',
      shape: 'cylinder',
      tech: 'Oracle',
      description: 'Accounts.',
    },
  ],
  groups: [{ id: 'ibs', label: 'Internet banking system' }],
  edges: [
    { from: 'cust', to: 'web', label: 'Visits' },
    { from: 'web', to: 'api', label: 'Calls' },
    { from: 'api', to: 'db', label: 'Reads' },
  ],
};

const component: GraphInput = {
  style: 'c4',
  nodes: [
    { id: 'spa', label: 'Single-page app', c4Kind: 'container', tech: 'Angular' },
    {
      id: 'sign',
      label: 'Sign-in controller',
      c4Kind: 'component',
      group: 'api',
      tech: 'Spring MVC',
    },
    {
      id: 'sec',
      label: 'Security component',
      c4Kind: 'component',
      group: 'api',
      tech: 'Spring bean',
    },
    { id: 'main', label: 'Mainframe', c4Kind: 'external' },
  ],
  groups: [{ id: 'api', label: 'API application', members: ['sign', 'sec'] }],
  edges: [
    { from: 'spa', to: 'sign', label: 'Calls' },
    { from: 'sign', to: 'sec', label: 'Uses' },
    { from: 'sec', to: 'main', label: 'Uses' },
  ],
};

describe('the c4 style', () => {
  it('draws a System Context: a person, the system and an external system, each in its colours', () => {
    const els = lay(context);
    const cust = shape(els, 'cust');
    expect(cust).toMatchObject({
      shape: 'card',
      pageTitle: 'Personal banking customer',
      pageSubtitle: 'Person',
      label: 'Has accounts.',
      fillColor: C4_LOOK.person.fill,
      themeLockFill: true,
    });
    expect(cust.colorPreset).toBeUndefined();
    expect(shape(els, 'ibs')).toMatchObject({
      pageSubtitle: 'Software system',
      fillColor: C4_LOOK.system.fill,
    });
    expect(shape(els, 'mail')).toMatchObject({
      pageSubtitle: 'Microsoft Exchange',
      fillColor: C4_LOOK.external.fill,
    });
    // A long name widens its card rather than being cut.
    expect(cust.width).toBeGreaterThan(280);
    expect(texts(els)).toEqual(
      expect.arrayContaining(['Person', 'Software system', 'External system']),
    );
  });

  it('draws a Container Diagram: the group a software system boundary, its members containers', () => {
    const els = lay(container);
    const boundary = shape(els, 'ibs');
    expect(boundary).toMatchObject({
      shape: 'boundary',
      boundaryStyle: 'c4',
      label: 'Internet banking system',
      pageSubtitle: 'Software system',
    });
    expect(shape(els, 'web')).toMatchObject({
      pageSubtitle: 'Angular',
      fillColor: C4_LOOK.container.fill,
    });
    // The database is a cylinder with its technology, its description kept in its note.
    expect(shape(els, 'db')).toMatchObject({
      shape: 'cylinder',
      label: 'Database\nOracle',
      note: 'Accounts.',
    });
    // The heading band sits at the boundary's foot: the members start just inside its top.
    const top = Math.min(...['web', 'api', 'db'].map((id) => shape(els, id).y));
    expect(top - boundary.y).toBeLessThan(64);
    const bottom = Math.max(
      ...['web', 'api', 'db'].map((id) => shape(els, id).y + shape(els, id).height),
    );
    expect(boundary.y + boundary.height - bottom).toBeGreaterThanOrEqual(48);
  });

  it('draws a Component Diagram: a group holding components is a container boundary', () => {
    const els = lay(component);
    expect(shape(els, 'api')).toMatchObject({ boundaryStyle: 'c4', pageSubtitle: 'Container' });
    expect(shape(els, 'sign')).toMatchObject({
      fillColor: C4_LOOK.component.fill,
      textColor: C4_LOOK.component.ink,
    });
    expect(shape(els, 'main').pageSubtitle).toBe('External system');
  });

  it('cuts a long description into the note, and leaves out or renames the key', () => {
    const long = 'x'.repeat(C4_DESCRIPTION_MAX + 30);
    const g: GraphInput = {
      ...context,
      nodes: [...context.nodes.slice(1), { id: 'cust', description: long }],
    };
    const els = lay(g);
    expect(shape(els, 'cust').note).toBe(long);
    expect((shape(els, 'cust').label ?? '').length).toBeLessThanOrEqual(C4_DESCRIPTION_MAX);
    expect(texts(lay({ ...context, key: false }))).not.toContain('Person');
    const renamed = lay({ ...context, key: { person: 'Customer' } });
    expect(texts(renamed)).toContain('Customer');
  });

  it('draws no key for a single kind', () => {
    const els = lay({
      style: 'c4',
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b' }],
    });
    expect(els.some((e) => e.type === 'shape' && e.label === 'Key')).toBe(false);
  });

  it('ignores a C4 spec smuggled in through JSON', () => {
    const els = lay({
      nodes: [{ id: 'a', label: 'A', c4Kind: 'person' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b' }],
    });
    expect(shape(els, 'a').fillColor).not.toBe(C4_LOOK.person.fill);
  });
});
