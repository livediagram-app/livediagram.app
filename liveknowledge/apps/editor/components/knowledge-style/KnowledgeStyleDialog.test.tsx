// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KNOWLEDGE_STYLE, type KnowledgeStyle } from '@liveknowledge/document';
import type { TabStyleView } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { onAnyPage } from '@liveworkspace/workbench/components/primitives/paged-carousel-testing';
import { bindStyleChange } from '@/lib/knowledge-style/style-change';
import { knowledgeStyleStore } from '@/lib/knowledge-style/knowledge-style-store';
import { KnowledgeStyleDialog } from './KnowledgeStyleDialog';

// The confirm a close with picks asks (owner 2026-11-21: the style is the whole knowledgebase's): each test answers.
let answer = true;
const asked = vi.fn<(o: { title: string }) => void>();
vi.mock('@liveworkspace/workbench/hooks/ui/useConfirm', () => ({
  useConfirm: () => async (o: { title: string }) => {
    asked(o);
    return answer;
  },
}));

const track = vi.fn<(...a: unknown[]) => void>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));
// Rendered on its own there is no editor store: the dialog reads the open knowledgebase's id through this.
vi.mock('./useOpenKnowledgeStyle', async () => {
  const store = await import('@/lib/knowledge-style/knowledge-style-store');
  return {
    useOpenKnowledgeStyle: () => store.useKnowledgeStyle('kb'),
    useOpenKnowledgeId: () => 'kb',
  };
});

// jsdom has no ResizeObserver; the dialog's animated height measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style".
// What the dialog showed (its previews), and what was applied for everyone through the door.
let changes: KnowledgeStyle[] = [];
let applied: KnowledgeStyle[] = [];
let unsubscribe = () => {};
beforeEach(() => {
  changes = [];
  answer = true;
  asked.mockClear();
  // An Editor's session: the door is bound, and a change is shown at once, as the editor's slice does.
  applied = [];
  bindStyleChange((next) => {
    applied.push(next);
    knowledgeStyleStore.set('kb', next);
  });
  const sub = knowledgeStyleStore.subscribe(() => changes.push(knowledgeStyleStore.styleOf('kb')));
  unsubscribe = () => void sub();
});
afterEach(() => {
  unsubscribe();
  cleanup();
  bindStyleChange(null);
  knowledgeStyleStore.clear();
  track.mockClear();
  document.body.innerHTML = '';
});

function Open({ start = 'looks' as TabStyleView, onClose = () => {} }) {
  const [view, setView] = useState<TabStyleView>(start);
  return <KnowledgeStyleDialog view={view} onViewChange={setView} onClose={onClose} />;
}
const dialog = () => screen.getByRole('dialog', { name: 'Knowledgebase Style' });
/** A card of a carousel ("Looks", "Themes"), paged to if it is not on the page on show. */
const card = (carousel: string, name: string | RegExp): HTMLElement =>
  onAnyPage(
    carousel,
    () => within(dialog()).queryByRole('button', { name }),
    (el) => fireEvent.click(el),
    dialog(),
  )!;

/** Close the dialog, answering its confirm; waits for the answer to land. */
async function closeWith(apply: boolean) {
  answer = apply;
  fireEvent.click(within(dialog()).getByRole('button', { name: /^Close/ }));
  await vi.waitFor(() => expect(asked).toHaveBeenCalled());
  await Promise.resolve();
}

describe('Knowledgebase Style', () => {
  it('is titled Knowledgebase Style, says what it styles, and is the centred dialog', () => {
    render(<Open />);
    expect(within(dialog()).getByRole('heading', { name: 'Knowledgebase Style' })).toBeTruthy();
    expect(dialog().textContent).toContain('Pick a look for every page of this knowledgebase.');
    // Not hung from a button: no anchored offsets.
    expect(dialog().style.right).toBe('');
    expect(dialog().style.top).toBe('');
    expect(screen.queryByRole('dialog', { name: 'Tab style' })).toBeNull();
  });

  it('keeps the looks, Seasonal and Mashup, and Fine-tune holds Text and Colours alone', () => {
    render(<Open />);
    const d = within(dialog());
    expect(
      d.getByRole('button', { name: 'Mashup: a random look, press for another' }),
    ).toBeTruthy();
    expect(d.getByRole('button', { name: 'Seasonal' }).getAttribute('aria-pressed')).toBe('false');
    expect(d.getByRole('button', { name: 'Text: Inter, Medium' })).toBeTruthy();
    expect(d.getByRole('button', { name: 'Colours: Lime theme' })).toBeTruthy();
    // Cut: the Canvas panel, New Page Background, the Finish filter and panel, Apply to All Tabs, Show Me.
    for (const gone of [
      /^Canvas/,
      /^New Page Background/,
      /^Finish/,
      /Apply to All Tabs/,
      /Show Me/,
    ])
      expect(d.queryByRole('button', { name: gone })).toBeNull();
    expect(d.queryByRole('combobox', { name: 'Filter looks by finish' })).toBeNull();
    expect(dialog().textContent).not.toMatch(/tab|canvas|finish/i);
  });

  it('draws each look as a page of writing, and shows Everyday selected for a new knowledgebase', () => {
    render(<Open />);
    const everyday = within(dialog()).getByRole('button', { name: /^Everyday/ });
    expect(everyday.getAttribute('aria-pressed')).toBe('true');
    expect(everyday.textContent).toContain('Lime, Inter');
    expect(everyday.querySelector('svg')!.textContent).toContain('Team Handbook');
    expect(everyday.querySelector('svg path')).toBeNull();
  });

  it('applies a look as one change of the theme and both fonts, and counts it', async () => {
    render(<Open />);
    fireEvent.click(card('Looks', /^Boardroom/));
    // Previewed here, nothing applied or counted until the close is confirmed.
    expect(changes).toEqual([{ ...DEFAULT_KNOWLEDGE_STYLE, theme: 'steel' }]);
    expect(applied).toEqual([]);
    expect(track).not.toHaveBeenCalled();
    expect(
      within(dialog())
        .getByRole('button', { name: /^Boardroom/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(within(dialog()).getByRole('button', { name: 'Colours: Steel theme' })).toBeTruthy();
    await closeWith(true);
    expect(asked).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Apply This Style to the Whole Knowledgebase?' }),
    );
    expect(applied).toEqual([{ ...DEFAULT_KNOWLEDGE_STYLE, theme: 'steel' }]);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'Look');
  });

  it('puts the saved style back when the changes are discarded', async () => {
    render(<Open />);
    fireEvent.click(card('Looks', /^Boardroom/));
    expect(knowledgeStyleStore.styleOf('kb').theme).toBe('steel');
    await closeWith(false);
    expect(applied).toEqual([]);
    expect(knowledgeStyleStore.styleOf('kb')).toEqual(DEFAULT_KNOWLEDGE_STYLE);
    expect(track).not.toHaveBeenCalled();
  });

  it('closes without asking when nothing was picked', () => {
    const onClose = vi.fn();
    render(<Open onClose={onClose} />);
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Close/ }));
    expect(asked).not.toHaveBeenCalled();
  });

  it('rolls a mashup and applies a seasonal look, each counted as itself', async () => {
    render(<Open />);
    const d = within(dialog());
    fireEvent.click(d.getByRole('button', { name: 'Mashup: a random look, press for another' }));
    expect(changes).toHaveLength(1);
    fireEvent.click(d.getByRole('button', { name: 'Seasonal' }));
    // The seasonal looks only, with no Mashup card.
    expect(d.queryByRole('button', { name: /^Mashup/ })).toBeNull();
    fireEvent.click(card('Looks', /Fireside/));
    expect(changes[1]).toMatchObject({ theme: 'evergreen', headingFont: 'roboto-slab' });
    await closeWith(true);
    // One change for everyone: the last pick, each kind picked counted.
    expect(applied).toHaveLength(1);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'Mashup');
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'SeasonalLook');
  });

  it('opens Text under the shared back bar: fonts, size, spacing and heading style', async () => {
    render(<Open />);
    const d = within(dialog());
    fireEvent.click(d.getByRole('button', { name: 'Text: Inter, Medium' }));
    expect(dialog().textContent).toContain(
      'The typefaces, size and spacing every page is written in.',
    );
    fireEvent.change(d.getByRole('combobox', { name: 'Heading Font' }), {
      target: { value: 'poppins' },
    });
    fireEvent.change(d.getByRole('combobox', { name: 'Body Font' }), { target: { value: 'lora' } });
    fireEvent.click(within(d.getByRole('radiogroup', { name: 'Text Size' })).getByText('Large'));
    fireEvent.click(
      within(d.getByRole('radiogroup', { name: 'Line Spacing' })).getByText('Relaxed'),
    );
    fireEvent.click(
      within(d.getByRole('radiogroup', { name: 'Heading Style' })).getByText('Ruled'),
    );
    expect(changes.at(-1)).toEqual({
      theme: 'brand',
      headingFont: 'poppins',
      bodyFont: 'lora',
      textSize: 'large',
      lineSpacing: 'relaxed',
      headingStyle: 'ruled',
    });
    expect(changes).toHaveLength(5);
    // The options are worded for writing, in Title Case.
    for (const name of [
      'Small',
      'Medium',
      'Large',
      'Compact',
      'Comfortable',
      'Relaxed',
      'Plain',
      'Ruled',
    ])
      expect(d.getByRole('radio', { name })).toBeTruthy();
    // No margins, page numbers or paragraph spacing.
    expect(dialog().textContent).not.toMatch(/margin|page number|paragraph/i);
    // The shared back bar goes home, where the row now says what the knowledgebase holds.
    fireEvent.click(d.getByRole('button', { name: /Knowledgebase Style/ }));
    expect(d.getByRole('button', { name: 'Text: Poppins and Lora, Large' })).toBeTruthy();
    await closeWith(true);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'Text');
  });

  it('moves a segmented choice with the arrow keys', () => {
    render(<Open start="font" />);
    const group = within(dialog()).getByRole('radiogroup', { name: 'Text Size' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(changes.at(-1)!.textSize).toBe('large');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(changes.at(-1)!.textSize).toBe('small');
  });

  it('opens Colours: themes as pages of writing, and the accent within the theme', async () => {
    knowledgeStyleStore.set('kb', { ...DEFAULT_KNOWLEDGE_STYLE, accent: '#0ea5e9' });
    render(<Open start="theme" />);
    const d = within(dialog());
    expect(dialog().textContent).toContain('The theme, and the accent the writing takes.');
    const lime = card('Themes', 'Lime');
    expect(lime.getAttribute('aria-pressed')).toBe('true');
    expect(lime.querySelector('svg')!.textContent).toContain('How We Work');
    expect(d.getByRole('button', { name: 'Accent Colour' })).toBeTruthy();
    expect(dialog().textContent).toContain('Your colour for headings, links, quotes and tables.');
    // Picking a theme puts the accent back on the theme's own.
    fireEvent.click(card('Themes', 'Forest'));
    expect(changes.at(-1)).toEqual({ ...DEFAULT_KNOWLEDGE_STYLE, theme: 'forest' });
    // No seasonal theme is listed, and no card says canvas, grid or finish.
    expect(d.queryByRole('button', { name: 'Frost' })).toBeNull();
    expect(dialog().textContent).not.toMatch(/canvas|grid|finish/i);
    await closeWith(true);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'Colours');
  });

  it('changes nothing for a session the door is not bound for', () => {
    bindStyleChange(null);
    render(<Open />);
    fireEvent.click(card('Looks', /^Boardroom/));
    expect(knowledgeStyleStore.styleOf('kb')).toBe(DEFAULT_KNOWLEDGE_STYLE);
    expect(track).not.toHaveBeenCalled();
  });

  it('closes on Escape and from the close button', () => {
    const onClose = vi.fn();
    render(<Open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Close/ }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
