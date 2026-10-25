// @vitest-environment jsdom
// The Pages tour's tracks (docs/specs/007-editor/pages-tour.md "The steps"): one per page kind, as Show Me
// runs them, left without a control that is not on screen.
import { describe, expect, it } from 'vitest';
import type { PageTourApi } from './page-tour-api';
import { pageTourSteps, shownPageTourSteps, stepShown } from './page-tour-steps';
import { pagesTourStepTelemetryType } from './PagesTourHost';

const api: PageTourApi = { pageId: 'p1', openPanel: () => {}, closePanel: () => {} };
const ids = (steps: { id: string }[]) => steps.map((s) => s.id);
const everything = () => true;

describe('the tracks', () => {
  it('Wireframe: its name, layout, background, device, another page, present', () => {
    const steps = pageTourSteps('wireframe');
    expect(ids(steps)).toEqual([
      'page-name',
      'layouts',
      'background',
      'page-size',
      'add-page',
      'present',
      'outro',
    ]);
    const device = steps.find((s) => s.id === 'page-size')!;
    expect(device.title).toBe('Device');
    expect(device.body).toMatch(/device/);
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

  it('holds every control to the tour page, never the first page', () => {
    for (const kind of ['wireframe', 'logo'] as const) {
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
    const steps = shownPageTourSteps('logo', api, everything);
    expect(steps[0]!.card).toBeUndefined();
    expect(steps.at(-1)!.card).toBe('outro');
  });

  it('leaves out a step whose control is not on screen (no Slides button on a phone)', () => {
    const exists = (sel: string) => !sel.includes('data-tour-id="slides"');
    expect(ids(shownPageTourSteps('wireframe', api, exists))).not.toContain('present');
    expect(ids(shownPageTourSteps('wireframe', api, exists))).toContain('layouts');
  });

  it('checks what a step opens by the button that opens it', () => {
    const layouts = pageTourSteps('wireframe').find((s) => s.id === 'layouts')!;
    const seen: string[] = [];
    stepShown(layouts, api, (sel) => {
      seen.push(sel);
      return true;
    });
    expect(seen).toEqual(['[data-page-id="p1"] button[aria-label="Layout"]']);
  });

  it('always keeps a card with nothing to point at', () => {
    const outro = pageTourSteps('wireframe').find((s) => s.id === 'outro')!;
    expect(stepShown(outro, api, () => false)).toBe(true);
  });
});

describe('telemetry', () => {
  it('names the track in each step view', () => {
    expect(pagesTourStepTelemetryType('logo', 'add-page')).toBe('PagesTourStepLogoAddPage');
    expect(pagesTourStepTelemetryType('wireframe', 'page-size')).toBe(
      'PagesTourStepWireframePageSize',
    );
  });
});
