import { describe, expect, it } from 'vitest';
import { parseStoredPresentation, type Slide, type Tab } from '@livediagram/document';
import { buildTemplateTab } from './template-tab';
import { isPresentedTemplate, templateSlides, withAppendedSlides } from './template-slides';
import { TEMPLATE_SLIDES } from './template-slides-data';
import type { TemplateKind } from './templates';

const PRESENTED = Object.keys(TEMPLATE_SLIDES) as TemplateKind[];

const counter = () => {
  let n = 0;
  return () => `slide-${n++}`;
};

const slidesOf = (kind: TemplateKind, tab: Tab = buildTemplateTab('tab-1', 'Tab', kind, 'brand')) =>
  ({ tab, slides: templateSlides(kind, tab, counter()) }) as const;

describe('templateSlides', () => {
  it('seeds the presented templates the talk tracks name', () => {
    expect(PRESENTED).toEqual(
      expect.arrayContaining([
        'roadmap',
        'business-model-canvas',
        'incident-postmortem',
        'gantt',
        'okr-tree',
        'funnel',
        'venn',
        'pyramid',
        'comparison-table',
        'milestone-timeline',
        'milestone-timeline-vertical',
      ]),
    );
    expect(isPresentedTemplate('roadmap')).toBe(true);
    expect(isPresentedTemplate('swot')).toBe(false);
  });

  it.each(PRESENTED)('%s finds every slide, in talk order, on the tab it built', (kind) => {
    const { tab, slides } = slidesOf(kind);
    const specs = TEMPLATE_SLIDES[kind]!;
    expect(slides.map((s) => s.name)).toEqual(specs.map((s) => s.name));
    expect(slides.map((s) => s.notes)).toEqual(specs.map((s) => s.notes));
    const ids = new Set(tab.elements.map((e) => e.id));
    for (const slide of slides) {
      expect(slide.tabId).toBe('tab-1');
      expect(slide.elementIds.length).toBeGreaterThan(0);
      expect(slide.elementIds.every((id) => ids.has(id))).toBe(true);
    }
    expect(new Set(slides.map((s) => s.id)).size).toBe(slides.length);
  });

  it.each(PRESENTED)('%s opens on the whole board, and each section shows less', (kind) => {
    const { tab, slides } = slidesOf(kind);
    const [overview, ...sections] = slides;
    const drawn = tab.elements.filter((e) => e.type !== 'arrow').map((e) => e.id);
    expect(overview!.elementIds).toEqual(drawn);
    for (const section of sections) {
      expect(section.elementIds.length).toBeLessThan(overview!.elementIds.length);
    }
  });

  it('takes in a section panel and what sits under its heading', () => {
    const bmc = slidesOf('business-model-canvas');
    const labels = (slide: Slide, tab: Tab) =>
      slide.elementIds.map((id) => {
        const el = tab.elements.find((e) => e.id === id) as { label?: string };
        return el.label ?? '';
      });
    expect(labels(bmc.slides[1]!, bmc.tab)).toEqual(
      expect.arrayContaining(['Customer Segments', 'Busy professionals cooking for two']),
    );
    const pm = slidesOf('incident-postmortem');
    const actions = pm.slides.find((s) => s.name === 'Action items')!;
    expect(
      actions.elementIds.some((id) => pm.tab.elements.find((e) => e.id === id)?.type === 'table'),
    ).toBe(true);
    const gantt = slidesOf('gantt');
    // A row slide spans the plan's width: its bars carry no label of their own.
    expect(gantt.slides[1]!.elementIds.length).toBeGreaterThan(2);
  });

  it('seeds nothing for a template that is not presented, or a tab it no longer finds', () => {
    expect(slidesOf('swot').slides).toEqual([]);
    const tab = buildTemplateTab('tab-1', 'Tab', 'roadmap', 'brand');
    expect(templateSlides('roadmap', { ...tab, elements: [] }, counter())).toEqual([]);
    // A board whose anchors are gone keeps only what it still finds: the overview.
    const unlabelled = {
      ...tab,
      elements: tab.elements.map((e) => ({ ...e, label: '', pageTitle: undefined })),
    } as Tab;
    expect(templateSlides('roadmap', unlabelled, counter()).map((s) => s.name)).toEqual([
      'Overview',
    ]);
  });
});

describe('withAppendedSlides', () => {
  const slide = (id: string): Slide => ({ id, tabId: 't', elementIds: ['e'] });

  it('starts a deck when there is none', () => {
    const next = withAppendedSlides(null, [slide('a')]);
    expect(parseStoredPresentation(next)?.decks[0]?.slides.map((s) => s.id)).toEqual(['a']);
  });

  it('appends after the slides a deck already shows, keeping any later deck', () => {
    const stored = JSON.stringify({
      decks: [{ slides: [slide('a')] }, { slides: [slide('z')] }],
    });
    const next = parseStoredPresentation(withAppendedSlides(stored, [slide('b'), slide('c')]));
    expect(next?.decks.map((d) => d.slides.map((s) => s.id))).toEqual([['a', 'b', 'c'], ['z']]);
  });

  it('adds a slide the deck already holds only once', () => {
    const stored = withAppendedSlides(null, [slide('a')]);
    expect(withAppendedSlides(stored, [slide('a')])).toBe(stored);
  });

  it('leaves the stored deck alone when nothing is added', () => {
    expect(withAppendedSlides('{"decks":[]}', [])).toBe('{"decks":[]}');
    expect(withAppendedSlides(null, [])).toBeNull();
  });
});
