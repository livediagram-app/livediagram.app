// @vitest-environment jsdom
// The Pages tour's tracks (docs/specs/007-editor/pages-tour.md "The steps"): one per page kind, as Show Me
// runs them and behind a welcome card as the tour offers them, left without a control that is not on screen.
import { describe, expect, it } from 'vitest';
import { readPinnedPageToolbar } from '@/components/canvas/article/page-toolbar-presence';
import type { PageTourApi } from './page-tour-api';
import { pagesTourSteps, pageTourSteps, shownPageTourSteps, stepShown } from './page-tour-steps';
import { pagesTourStepTelemetryType } from './PagesTourHost';

const api: PageTourApi = { pageId: 'p1', openPanel: () => {}, closePanel: () => {} };
const ids = (steps: { id: string }[]) => steps.map((s) => s.id);
const everything = () => true;

describe('the tracks', () => {
  it('Slides: layout, background, another slide, then the deck: its rows, a slide’s menu, the show, present', () => {
    expect(ids(pageTourSteps('slide'))).toEqual([
      'layouts',
      'background',
      'add-page',
      'deck',
      'slide-menu',
      'show-settings',
      'present',
      'outro',
    ]);
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

  it('Logo: the logo page’s Show Me steps', () => {
    expect(ids(pageTourSteps('logo'))).toEqual([
      'layouts',
      'guides',
      'mirror',
      'combine',
      'combine-menu',
      'combine-unite',
      'outro',
    ]);
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
    for (const kind of ['slide', 'infographic', 'article', 'logo'] as const) {
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
  it('opens the offer on the track’s own welcome card', () => {
    const steps = pagesTourSteps('slide', api, everything);
    expect(steps[0]).toMatchObject({ id: 'welcome', card: 'welcome' });
    expect(steps[0]!.title).toBe('Getting started with Slides?');
    expect(pagesTourSteps('article', api, everything)[0]!.title).toBe(
      'Getting started with Articles?',
    );
  });

  it('leaves out a step whose control is not on screen (no Slides button on a phone)', () => {
    const exists = (sel: string) => !sel.includes('data-tour-id="slides"');
    expect(ids(shownPageTourSteps('slide', api, exists))).not.toContain('present');
    expect(ids(shownPageTourSteps('slide', api, exists))).toContain('layouts');
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
