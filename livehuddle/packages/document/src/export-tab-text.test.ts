import type { RetiredArrowElement, Element, Tab } from './index';
import { describe, expect, it } from 'vitest';
import {
  TAB_SCHEMA_VERSION,
  tabToJsonText,
  tabToMarkdownText,
  type ExportedTabEnvelope,
} from './export-tab-text';

const shape = (id: string, over: Record<string, unknown> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'room',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...over,
});

const arrow = (id: string, over: Partial<RetiredArrowElement> = {}): Element => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 10, y: 10 },
  ...over,
});

const tab = (name: string, elements: Element[]): Tab => ({ name, elements }) as Tab;

describe('tabToJsonText', () => {
  it('wraps the tab in a versioned envelope', () => {
    const t = tab('My tab', [shape('a', { label: 'A' })]);
    const env = JSON.parse(tabToJsonText(t)) as ExportedTabEnvelope;
    expect(env.schemaVersion).toBe(TAB_SCHEMA_VERSION);
    expect(env.kind).toBe('livehuddle.tab');
    expect(typeof env.exportedAt).toBe('number');
    expect(env.tab).toEqual(t);
  });
});

describe('tabToMarkdownText', () => {
  const md = (t: Tab) => tabToMarkdownText(t).split('\n');

  it('titles with the tab name and tags shapes by kind', () => {
    const lines = md(tab('Flow', [shape('a', { label: 'Start' })]));
    expect(lines[0]).toBe('# Flow');
    expect(lines).toContain('## Elements');
    expect(lines).toContain('- **Start** (room)');
  });

  it('falls back to a default title when the tab is unnamed', () => {
    const lines = md(tab('', [shape('a', { label: 'X' })]));
    expect(lines[0]).toBe('# Untitled tab');
  });

  it('orders elements top-to-bottom then left-to-right', () => {
    const lines = md(
      tab('T', [
        shape('a', { label: 'Lower', x: 0, y: 100 }),
        shape('b', { label: 'UpperRight', x: 50, y: 10 }),
        shape('c', { label: 'UpperLeft', x: 0, y: 10 }),
      ]),
    );
    const order = lines.filter((l) => l.startsWith('- **'));
    expect(order).toEqual([
      '- **UpperLeft** (room)',
      '- **UpperRight** (room)',
      '- **Lower** (room)',
    ]);
  });

  it('drops unlabelled boxed elements and arrows', () => {
    const lines = md(
      tab('T', [shape('a'), arrow('x')]), // no labels anywhere
    );
    expect(lines).toContain('_No labelled content._');
    expect(lines).not.toContain('## Elements');
    expect(lines).not.toContain('## Connections');
  });

  // A stored arrow is retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4):
  // even a labelled one pinned between two labelled boxes lists no connection.
  it('lists no connection for a stored arrow, labelled or pinned', () => {
    const lines = md(
      tab('T', [
        shape('a', { label: 'Checkout' }),
        shape('b', { label: 'Enter card details' }),
        arrow('e', {
          label: 'flows to',
          from: { kind: 'pinned', elementId: 'a', anchor: 's' },
          to: { kind: 'pinned', elementId: 'b', anchor: 'n' },
        }),
      ]),
    );
    expect(lines).not.toContain('## Connections');
    expect(lines.some((l) => l.includes('→') || l.includes('flows to'))).toBe(false);
  });
});

describe('tabToMarkdownText', () => {
  it('writes every labelled element and leaves a stored arrow out', () => {
    const t = tab('T', [
      shape('a', { label: 'First' }),
      shape('b', { label: 'Second note' }),
      arrow('e', {
        from: { kind: 'pinned', elementId: 'a', anchor: 's' },
        to: { kind: 'pinned', elementId: 'b', anchor: 'n' },
      }),
    ]);
    const md = tabToMarkdownText(t);
    expect(md).toContain('First');
    expect(md).toContain('Second note');
    expect(md).not.toContain('## Connections');
  });
});
