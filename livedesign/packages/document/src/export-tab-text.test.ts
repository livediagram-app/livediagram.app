import type { Element, Tab } from './index';
import { describe, expect, it } from 'vitest';
import { TAB_SCHEMA_VERSION, tabToJsonText, type ExportedTabEnvelope } from './export-tab-text';

const shape = (id: string, over: Record<string, unknown> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...over,
});

const tab = (name: string, elements: Element[]): Tab => ({ name, elements }) as Tab;

describe('tabToJsonText', () => {
  it('wraps the tab in a versioned envelope', () => {
    const t = tab('My tab', [shape('a', { label: 'A' })]);
    const env = JSON.parse(tabToJsonText(t)) as ExportedTabEnvelope;
    expect(env.schemaVersion).toBe(TAB_SCHEMA_VERSION);
    expect(env.kind).toBe('livedesign.tab');
    expect(typeof env.exportedAt).toBe('number');
    expect(env.tab).toEqual(t);
  });
});
