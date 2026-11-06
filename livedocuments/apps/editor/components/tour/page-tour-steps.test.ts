// @vitest-environment jsdom
// The Pages tour's tracks (docs/specs/007-editor/pages-tour.md "The steps"): one per page kind, as Show Me
// runs them, left without a control that is not on screen.
import { describe, expect, it } from 'vitest';
import { readPinnedPageToolbar } from '@/components/canvas/article/page-toolbar-presence';
import type { PageTourApi } from './page-tour-api';
import { pageTourSteps, shownPageTourSteps, stepShown } from './page-tour-steps';
import { pagesTourStepTelemetryType } from './PagesTourHost';

const api: PageTourApi = { pageId: 'p1', openPanel: () => {}, closePanel: () => {} };
const ids = (steps: { id: string }[]) => steps.map((s) => s.id);
const everything = () => true;

describe('the tracks', () => {
  it('Slides: layout, background, another slide, then its row in Contents, its menu, present', () => {
    expect(ids(pageTourSteps('slide'))).toEqual([
      'layouts',
      'background',
      'add-page',
      'contents',
      'slide-menu',
      'present',
      'outro',
    ]);
  });

  it("points at the tour page's own Contents row and its menu, and at the header's Present", () => {
    const steps = pageTourSteps('slide');
    const at = (id: string) => steps.find((s) => s.id === id)!.selector!(api);
    expect(at('contents')).toBe('[data-contents-slot]:has([data-page-row="p1"])');
    expect(at('slide-menu')).toBe('[data-contents-slot]:has([data-page-row="p1"])');
    expect(at('present')).toBe('[data-presentation-start="header"]');
  });

  it('Infographic: its name, layout, background, size, another page, present', () => {
    expect(ids(pageTourSteps('infographic'))).toEqual([
      'page-name',
      'layouts',
      'background',
      'page-size',
      'add-page',
      'present',
      'outro',
    ]);
  });

  it('Article: the page, its toolbar, its style and type', () => {
    expect(ids(pageTourSteps('article'))).toEqual(['write', 'toolbar', 'style', 'text', 'outro']);
  });

  // docs/specs/007-editor/flashcards.md: a card, its toolbar, another card, its style.
  it('Flashcards: the card, its toolbar, another card, its style', () => {
    const steps = pageTourSteps('flashcard');
    expect(ids(steps)).toEqual(['write', 'toolbar', 'add-card', 'style', 'outro']);
    const toolbar = steps.find((s) => s.id === 'toolbar')!;
    expect(toolbar.requires?.(api)).toContain('"p1"');
    void toolbar.prepare?.(api);
    expect(readPinnedPageToolbar()).toBe('p1');
    toolbar.cleanup?.(api);
    expect(readPinnedPageToolbar()).toBeNull();
    expect(steps.find((s) => s.id === 'add-card')!.selector?.(api)).toBe(
      '[data-tour-id="add-page"]',
    );
  });

  it('holds the article toolbar up on the tour page through its step', () => {
    const toolbar = pageTourSteps('article').find((s) => s.id === 'toolbar')!;
    expect(toolbar.selector?.(api)).toBe('[role="toolbar"][aria-label="Article Formatting"]');
    void toolbar.prepare?.(api);
    expect(readPinnedPageToolbar()).toBe('p1');
    toolbar.cleanup?.(api);
    expect(readPinnedPageToolbar()).toBeNull();
  });

  it('holds every control to the tour page, never the first page', () => {
    for (const kind of ['slide', 'infographic', 'article', 'flashcard'] as const) {
      for (const step of pageTourSteps(kind)) {
        const selectors = [step.requires?.(api), step.selector?.(api)].filter(Boolean) as string[];
        for (const sel of selectors) {
          if (sel.includes('aria-label="Layout"') || sel.includes('page-cog'))
            expect(sel, `${kind} ${step.id}`).toContain('"p1"');
        }
      }
    }
  });
});

describe('what the tour starts with', () => {
  it('opens on the track’s first step, its last card closing it', () => {
    const steps = shownPageTourSteps('slide', api, everything);
    expect(steps[0]!.card).toBeUndefined();
    expect(steps.at(-1)!.card).toBe('outro');
  });

  it('leaves out a step whose control is not on screen (no Contents sidebar on a phone)', () => {
    const exists = (sel: string) => !sel.includes('data-contents-slot');
    const shown = ids(shownPageTourSteps('slide', api, exists));
    expect(shown).not.toContain('contents');
    expect(shown).not.toContain('slide-menu');
    expect(shown).toContain('present');
    expect(ids(shownPageTourSteps('infographic', api, exists))).not.toContain('present');
  });

  it('checks what a step opens by the button that opens it', () => {
    const layouts = pageTourSteps('slide').find((s) => s.id === 'layouts')!;
    const seen: string[] = [];
    stepShown(layouts, api, (sel) => {
      seen.push(sel);
      return true;
    });
    expect(seen).toEqual(['[data-page-id="p1"] button[aria-label="Layout"]']);
  });

  it('always keeps a card with nothing to point at', () => {
    const outro = pageTourSteps('slide').find((s) => s.id === 'outro')!;
    expect(stepShown(outro, api, () => false)).toBe(true);
  });
});

describe('telemetry', () => {
  it('names the track in each step view', () => {
    expect(pagesTourStepTelemetryType('slide', 'add-page')).toBe('PagesTourStepSlideAddPage');
    expect(pagesTourStepTelemetryType('infographic', 'page-size')).toBe(
      'PagesTourStepInfographicPageSize',
    );
  });
});
