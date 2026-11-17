// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Slide, Tab } from '@livediagram/document';
import { TEMPLATE_SLIDES, type TemplateKind } from '@livediagram/templates';
import { useTemplateFlow } from './useTemplateFlow';

// docs/specs/012-collaboration/presentation-mode.md "Decks a template seeds": a presented template picked on a tab's
// start puts its slides, in talk order, after whatever the deck already shows; any other template leaves the deck.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

async function pick(kind: TemplateKind, start: Tab) {
  let tabs: Tab[] = [start];
  const appendSlides = vi.fn<(slides: readonly Slide[]) => void>();
  const { result } = renderHook(() =>
    useTemplateFlow({
      activeId: start.id,
      tabs,
      selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
      documentName: 'Board',
      nameDocument: vi.fn(),
      getViewportCenter: () => ({ x: 0, y: 0 }),
      commitTabs: (update) => {
        tabs = update(tabs);
      },
      confirmName: vi.fn(),
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setSelfParticipant: vi.fn(),
      setIdentityPromptOpen: vi.fn(),
      requestFit: vi.fn(),
      putToolDown: vi.fn(),
      appendSlides,
    }),
  );
  await act(async () => {
    await result.current.chooseTemplate(kind);
  });
  return { appendSlides, tab: tabs[0]! };
}

const empty: Tab = { id: 't2', name: 'Tab 2', elements: [] };

describe('chooseTemplate and the deck', () => {
  it("appends a presented template's slides, on its tab, naming what landed", async () => {
    const { appendSlides, tab } = await pick('business-model-canvas', empty);
    expect(appendSlides).toHaveBeenCalledTimes(1);
    const slides = appendSlides.mock.calls[0]![0];
    expect(slides.map((s) => s.name)).toEqual(
      TEMPLATE_SLIDES['business-model-canvas']!.map((s) => s.name),
    );
    const ids = new Set(tab.elements.map((e) => e.id));
    for (const slide of slides) {
      expect(slide.tabId).toBe('t2');
      expect(slide.elementIds.every((id) => ids.has(id))).toBe(true);
    }
  });

  it('leaves the deck alone for a template nobody presents', async () => {
    const { appendSlides } = await pick('swot', empty);
    expect(appendSlides).not.toHaveBeenCalled();
  });

  it('adds nothing when the tab already has work on it', async () => {
    const busy: Tab = {
      ...empty,
      elements: [{ id: 'x', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as never],
    };
    const { appendSlides } = await pick('roadmap', busy);
    expect(appendSlides).not.toHaveBeenCalled();
  });
});
