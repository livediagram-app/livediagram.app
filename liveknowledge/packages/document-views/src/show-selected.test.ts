import { describe, expect, it } from 'vitest';
import { shapeAt } from './__fixtures__/build';
import { CHECKOUT_IDS, CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { SELECTED_REF } from './constants';
import { buildViewModel } from './model';
import { renderView } from './render-view';
import { showView } from './show';

// `show selected` (docs/specs/024-agents/document-views.md "The views"; blueprint "show selected", VW65 to VW68):
// the owner's live selection, every element in full, in tab order, fitted like any line view.

const show = (selected: readonly string[] | null | undefined, budget?: number) =>
  renderView({ view: 'show', ref: SELECTED_REF, budget }, checkoutTab(), {
    rev: CHECKOUT_REV,
    selected,
  });

// One element's `show` as it prints on its own, without the header.
const blockOf = (id: string) => {
  const model = buildViewModel(checkoutTab(), { rev: CHECKOUT_REV });
  const { text } = showView(
    model,
    model.printed.find((el) => el.id === id)!,
  );
  return text.slice(text.indexOf('\n') + 1);
};

describe('show selected (R27)', () => {
  it('prints every selected element in full, in tab order, under one header', () => {
    const rendered = show([CHECKOUT_IDS.payments, CHECKOUT_IDS.orders]);
    if (!rendered.ok) throw new Error(rendered.refusal.message);
    const [header] = rendered.text.split('\n');
    expect(header).toContain('· rev 41');
    expect(rendered.text).toBe(
      [header, blockOf(CHECKOUT_IDS.orders), '', blockOf(CHECKOUT_IDS.payments)].join('\n'),
    );
    expect(rendered.view).toBe('show');
  });

  it('answers the same elements as JSON, each as show holds it', () => {
    const rendered = show([CHECKOUT_IDS.payments, CHECKOUT_IDS.orders]);
    if (!rendered.ok) throw new Error(rendered.refusal.message);
    const json = rendered.json as {
      header: { view: string };
      selected: { ref: string; header?: unknown }[];
    };
    expect(json.header.view).toBe('show');
    expect(json.selected.map((s) => s.ref)).toEqual(['146b', 'e4a8']);
    expect(json.selected[0]).not.toHaveProperty('header');
  });

  it('drops ids that are not printed elements of the tab, and repeats (VW66)', () => {
    const rendered = show([CHECKOUT_IDS.orders, 'not-on-this-tab', CHECKOUT_IDS.orders]);
    if (!rendered.ok) throw new Error(rendered.refusal.message);
    expect((rendered.json as { selected: unknown[] }).selected).toHaveLength(1);
  });

  it('leaves out an element on a hidden layer', () => {
    const tab = {
      id: 't',
      name: 'T',
      elements: [
        shapeAt('square', 'seen', 0, 0),
        { ...shapeAt('square', 'gone', 200, 0), layerId: 'h' },
      ],
      layers: [
        { id: 'default', name: 'Default' },
        { id: 'h', name: 'Hidden', visible: false },
      ],
    };
    const rendered = renderView({ view: 'show', ref: SELECTED_REF }, tab, {
      selected: ['gone', 'seen'],
    });
    if (!rendered.ok) throw new Error(rendered.refusal.message);
    expect((rendered.json as { selected: { ref: string }[] }).selected.map((s) => s.ref)).toEqual([
      'seen',
    ]);
  });

  it('refuses nothing selected, and a selection it could not read, as edit operations do', () => {
    const nothing = { error: 'target_not_found', message: 'nothing is selected' };
    const unread = { error: 'target_not_found', message: 'the selection could not be read' };
    const common = { input: 'selected', candidates: [], stale: false };
    expect(show([])).toEqual({ ok: false, refusal: { ...nothing, ...common } });
    expect(show(['not-on-this-tab'])).toEqual({ ok: false, refusal: { ...nothing, ...common } });
    expect(show(null)).toEqual({ ok: false, refusal: { ...unread, ...common } });
    expect(show(undefined)).toEqual({ ok: false, refusal: { ...unread, ...common } });
  });

  it('reads selected as the selector, never as an element named so (VW65)', () => {
    const tab = { id: 't', name: 'T', elements: [shapeAt('square', 'selected', 0, 0)] };
    const rendered = renderView({ view: 'show', ref: SELECTED_REF }, tab, {});
    expect(rendered).toMatchObject({
      ok: false,
      refusal: { message: 'the selection could not be read' },
    });
  });

  it('fits a budget by whole lines, then says what it left out (VW67)', () => {
    const rendered = show([CHECKOUT_IDS.orders, CHECKOUT_IDS.payments, CHECKOUT_IDS.sticky], 60);
    if (!rendered.ok) throw new Error(rendered.refusal.message);
    expect(rendered.fit.state).toBe('lines-dropped');
    expect(rendered.text.split('\n').at(-1)).toMatch(/^… \d+ lines hidden/);
  });
});
