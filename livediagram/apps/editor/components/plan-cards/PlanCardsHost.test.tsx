// @vitest-environment jsdom
// The editor's one Make Plan Cards host (make-plan-cards.md "Where", "Making again", "Changes to the plan"): an entry
// opens the preview with the tab's shapes, a whole tab's make offering its removed shapes' cards; a session that may
// not send never listens; on a drawn tab an Editor's drawing edits are published as offers once the drawing settles.
import { act, cleanup, render, screen } from '@testing-library/react';
import { planSendRef, type PlanSend } from '@liveworkspace/index-client';
import type { Element } from '@livediagram/document';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sends = vi.hoisted(() => ({ value: [] as PlanSend[] }));
const shown = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@liveworkspace/workbench/components/send-to-plan/send-store', async (orig) => ({
  ...(await orig<object>()),
  useAllSends: () => sends.value,
}));
vi.mock('@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry', () => ({
  canSendHere: () => true,
}));
vi.mock('./PlanChangesPill', () => ({ setPlanChanges: (v: unknown) => (shown.value = v) }));
vi.mock('./MakePlanCardsDialog', () => ({
  MakePlanCardsDialog: (p: {
    shapes: { element: string }[];
    removed: unknown[];
    source: { label: string };
    onClose: () => void;
  }) => (
    <div role="dialog">
      {p.shapes.map((s) => s.element).join(',')}|{p.removed.length}|{p.source.label}
      <button type="button" onClick={p.onClose}>
        close
      </button>
    </div>
  ),
}));

import { PlanCardsHost } from './PlanCardsHost';
import { canMakePlanCards, openMakePlanCards } from '@/lib/plan-cards/make-entry';
import { arrow, box, lane, text } from '@/lib/plan-cards/test-elements';

const sent = (element: string): PlanSend => ({
  id: `s-${element}`,
  ref: planSendRef({ kind: 'element', tabId: 't1', elementId: element, part: null }),
  kind: 'element',
  plan: { id: 'P', title: 'Plan' },
  card: { id: `c-${element}`, title: 'C', column: 'To Do', done: false },
  link: 'https://lp',
  at: 1,
});

const host = (elements: Element[], over: Partial<Parameters<typeof PlanCardsHost>[0]> = {}) =>
  render(
    <PlanCardsHost
      itemId="D"
      tabId="t1"
      tabName="Roadmap"
      title="Doc"
      elements={elements}
      enabled
      canEdit
      {...over}
    />,
  );

beforeEach(() => {
  sends.value = [];
  shown.value = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PlanCardsHost', () => {
  it("opens the preview with the tab's shapes, and a whole tab's removed shapes' cards", async () => {
    sends.value = [sent('a'), sent('gone'), { ...sent('x'), ref: 'element:other:x:' }];
    host([box('a', 'A'), box('b', 'B', { x: 200 })]);
    expect(canMakePlanCards()).toBe(true);
    act(() => openMakePlanCards({ only: null }));
    expect((await screen.findByRole('dialog')).textContent).toContain('a,b|1|Roadmap');
    act(() => screen.getByRole('button', { name: 'close' }).click());
    expect(screen.queryByRole('dialog')).toBeNull();
    // A selection reads only what is picked, and never offers removed cards.
    act(() => openMakePlanCards({ only: ['b'] }));
    expect((await screen.findByRole('dialog')).textContent).toContain('b|0|');
  });

  it('opens nothing when there is nothing to make', () => {
    host([lane('l', 'Lane', { width: 10, height: 10 })]);
    act(() => openMakePlanCards({ only: null }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never listens in a session that may not send', () => {
    host([box('a', 'A')], { enabled: false });
    expect(canMakePlanCards()).toBe(false);
  });

  it("publishes a drawn tab's offers to an Editor once the drawing settles, and none to others", () => {
    vi.useFakeTimers();
    const drawn = [
      {
        ...text('plan:caption', 'From the plan'),
        link: { kind: 'url', url: 'https://lp/project/P1' },
      } as Element,
      box('card:todo:c1', 'Design'),
      box('card:todo:c2', 'Build', { x: 200 }),
    ];
    const view = host(drawn);
    expect(shown.value).toMatchObject({ planId: 'P1', offers: [] });
    view.rerender(
      <PlanCardsHost
        itemId="D"
        tabId="t1"
        tabName="R"
        title="Doc"
        elements={[...drawn, arrow('m', 'card:todo:c1', 'card:todo:c2')]}
        enabled
        canEdit
      />,
    );
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const now = shown.value as { offers: { key: string }[]; onDismiss: (k: string) => void };
    expect(now.offers.map((o) => o.key)).toEqual(['block:c1>c2']);
    act(() => now.onDismiss('block:c1>c2'));
    expect((shown.value as { offers: unknown[] }).offers).toEqual([]);
    view.rerender(
      <PlanCardsHost
        itemId="D"
        tabId="t1"
        tabName="R"
        title="Doc"
        elements={drawn}
        enabled
        canEdit={false}
      />,
    );
    expect(shown.value).toBeNull();
  });
});
