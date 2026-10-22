// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldsFor, OPTION_FIELDS } from './tool-option-fields';
import {
  DEFAULT_OPTIONS,
  GROUP_KEYS,
  groupOf,
  optionsKey,
  TOOL_CATEGORIES,
  TOOL_GROUPS,
  TOOL_NAMES,
  type PhotoToolId,
} from './tool-state';

// docs/specs/031-photo/photo-tools.md "The photo tools", "The options flyout": the tools, their groups and
// keys, each tool's options, and the store that keeps them for this browser.
const TOOLS = Object.keys(TOOL_NAMES) as PhotoToolId[];
const KEY = 'livedesign:photo-tools';

async function freshStore() {
  vi.resetModules();
  return (await import('./tool-state')).photoTools;
}

beforeEach(() => localStorage.clear());

describe('the photo tools’ categories', () => {
  it('hold every group once, in the groups’ own order', () => {
    expect(TOOL_CATEGORIES.flatMap((c) => c.groups)).toEqual(TOOL_GROUPS.map((g) => g.id));
  });
});

describe('the photo tools', () => {
  it('sit each in one group, every group on its own letter', () => {
    for (const tool of TOOLS)
      expect(
        TOOL_GROUPS.filter((g) => g.tools.includes(tool)),
        tool,
      ).toHaveLength(1);
    expect(TOOL_GROUPS.flatMap((g) => g.tools).sort()).toEqual([...TOOLS].sort());
    const letters = TOOL_GROUPS.map((g) => GROUP_KEYS[g.id]).filter(Boolean);
    expect(new Set(letters).size).toBe(letters.length);
    expect(groupOf('pencil').id).toBe('brush');
  });

  it('show only options each tool has, each with a default', () => {
    for (const tool of TOOLS) {
      const key = optionsKey(tool);
      const defaults = DEFAULT_OPTIONS[key] as Record<string, unknown>;
      for (const f of fieldsFor(tool, key))
        expect(defaults, `${tool}.${f.key}`).toHaveProperty(f.key);
    }
    for (const key of Object.keys(OPTION_FIELDS)) expect(DEFAULT_OPTIONS).toHaveProperty(key);
  });

  it('keep a tool’s own fields to that tool', () => {
    const keys = (tool: PhotoToolId) => fieldsFor(tool, optionsKey(tool)).map((f) => f.key);
    expect(keys('rectangle')).toContain('radius');
    expect(keys('ellipse')).not.toContain('radius');
    expect(keys('line')).toContain('endArrow');
    expect(keys('rectangle')).not.toContain('endArrow');
    expect(keys('gradient')).toContain('gradient');
  });
});

describe('the tools store', () => {
  it('takes a tool in hand, its group remembering it, and puts it down', async () => {
    const t = await freshStore();
    const seen = vi.fn();
    const off = t.subscribe(seen);
    t.take('pencil');
    expect(t.get().tool).toBe('pencil');
    expect(t.get().lastInGroup.brush).toBe('pencil');
    t.take(null);
    expect(t.get().tool).toBeNull();
    expect(t.get().lastInGroup.brush).toBe('pencil');
    off();
    t.take('brush');
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('changes, resets and keeps a tool’s options', async () => {
    const t = await freshStore();
    t.setOptions('brush', { size: 99 });
    expect(t.get().options.brush.size).toBe(99);
    expect(t.get().options.brush.hardness).toBe(DEFAULT_OPTIONS.brush.hardness);
    t.resetOptions('brush');
    expect(t.get().options.brush).toEqual(DEFAULT_OPTIONS.brush);
  });

  it('swaps and resets the colours', async () => {
    const t = await freshStore();
    t.set({ foreground: '#112233', background: '#445566' });
    t.swapColours();
    expect([t.get().foreground, t.get().background]).toEqual(['#445566', '#112233']);
    t.resetColours();
    expect([t.get().foreground, t.get().background]).toEqual(['#000000', '#ffffff']);
  });

  it('remembers all but the tool in hand for this browser', async () => {
    const t = await freshStore();
    t.take('eraser');
    t.setOptions('eraser', { size: 7 });
    t.set({ foreground: '#abcdef' });
    const kept = JSON.parse(localStorage.getItem(KEY)!) as Record<string, unknown>;
    expect(kept).not.toHaveProperty('tool');
    const again = await freshStore();
    expect(again.get().tool).toBeNull();
    expect(again.get().options.eraser.size).toBe(7);
    expect(again.get().foreground).toBe('#abcdef');
    expect(again.get().lastInGroup.eraser).toBe('eraser');
  });

  it('fills in options it has never kept and ignores colours that are not hex', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ options: { brush: { size: 3 } }, foreground: 'red', background: 7 }),
    );
    const t = await freshStore();
    expect(t.get().options.brush.size).toBe(3);
    expect(t.get().options.brush.hardness).toBe(DEFAULT_OPTIONS.brush.hardness);
    expect(t.get().options.gradient).toEqual(DEFAULT_OPTIONS.gradient);
    expect([t.get().foreground, t.get().background]).toEqual(['#000000', '#ffffff']);
  });

  it("forgets Move's Auto-Select kept off by an older save, so its new default holds", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ options: { move: { autoSelect: false }, shape: { intoActive: false } } }),
    );
    expect((await freshStore()).get().options.move.autoSelect).toBe(true);
    expect((await freshStore()).get().options.shape.intoActive).toBe(true);
    // A save from now on is the person's own choice, kept.
    const t = await freshStore();
    t.setOptions('move', { autoSelect: false });
    expect((await freshStore()).get().options.move.autoSelect).toBe(false);
  });

  it('starts afresh from a kept value it cannot read, and works with storage blocked', async () => {
    localStorage.setItem(KEY, '{not json');
    const t = await freshStore();
    expect(t.get().options).toEqual(DEFAULT_OPTIONS);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    t.setOptions('brush', { size: 5 });
    expect(t.get().options.brush.size).toBe(5);
    spy.mockRestore();
  });
});
