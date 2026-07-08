import type { ArrowElement, Element, Tab } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import {
  TAB_SCHEMA_VERSION,
  tabToJsonText,
  tabToMarkdownText,
  type ExportedTabEnvelope,
} from './export-tab-text';

const shape = (id: string, over: Record<string, unknown> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...over }) as Element;

const arrow = (id: string, over: Partial<ArrowElement> = {}): Element =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 10, y: 10 },
    ...over,
  }) as Element;

const tab = (name: string, elements: Element[]): Tab => ({ name, elements }) as Tab;

describe('tabToJsonText', () => {
  it('wraps the tab in a versioned envelope', () => {
    const t = tab('My tab', [shape('a', { label: 'A' })]);
    const env = JSON.parse(tabToJsonText(t)) as ExportedTabEnvelope;
    expect(env.schemaVersion).toBe(TAB_SCHEMA_VERSION);
    expect(env.kind).toBe('livediagram.tab');
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
    expect(lines).toContain('- **Start** (square)');
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
      '- **UpperLeft** (square)',
      '- **UpperRight** (square)',
      '- **Lower** (square)',
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

  it('renders labelled arrows with resolved endpoint labels', () => {
    const lines = md(
      tab('T', [
        shape('a', { label: 'A' }),
        arrow('e', {
          label: 'flows to',
          from: { kind: 'pinned', elementId: 'a', anchor: 's' },
          to: { kind: 'free', x: 12.4, y: 30.6 },
        } as Partial<ArrowElement>),
      ]),
    );
    expect(lines).toContain('## Connections');
    // pinned endpoint resolves to its target's label; free endpoint rounds.
    expect(lines).toContain('- *flows to*: A → (12, 31)');
  });

  it('shows ? for an arrow pinned to a missing element', () => {
    const lines = md(
      tab('T', [
        arrow('e', {
          label: 'dangles',
          from: { kind: 'pinned', elementId: 'gone', anchor: 'n' },
          to: { kind: 'free', x: 0, y: 0 },
        } as Partial<ArrowElement>),
      ]),
    );
    expect(lines).toContain('- *dangles*: ? → (0, 0)');
  });
});
