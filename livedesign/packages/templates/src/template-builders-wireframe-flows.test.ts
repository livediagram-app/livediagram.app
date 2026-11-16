// docs/specs/007-editor/wireframe-pages.md "A flow's own words" and "A flow's links": every wireframe flow opens in
// its own words and linked, so Prototype mode plays it as it opens.
import { describe, expect, it } from 'vitest';
import {
  createShape,
  createText,
  isScreenLink,
  layOutPages,
  resolveScreenLink,
  type Element,
  type ScreenLink,
} from '@livedesign/design';
import { BACK, WIREFRAME_FLOWS, type WireframeFlowKind } from './wireframe-flow-data';
import {
  FLOW_SLIDE_DEVICES,
  buildWireframeFlowScreens,
  findControl,
  linkScreen,
  relabelScreen,
  wireframeFlowPages,
} from './template-builders-wireframe-flows';
import { buildPageLayout } from './page-layout-build';
import { buildTemplateTab } from './template-tab';

const KINDS = Object.keys(WIREFRAME_FLOWS) as WireframeFlowKind[];
const labelOf = (el: Element) => (el as { label?: string }).label;
const linkOf = (el: Element) => (el as { link?: ScreenLink }).link;
const isBackArrow = (el: Element) =>
  el.type === 'shape' && el.shape === 'icon' && el.iconId === 'arrow-left';

// The layouts' own labels on each screen of a flow, before its words.
function layoutLabels(kind: WireframeFlowKind): Set<string>[] {
  const flow = WIREFRAME_FLOWS[kind];
  return layOutPages(wireframeFlowPages(kind)).map(
    (page, i) =>
      new Set(
        buildPageLayout(flow.screens[i]!.layout, page)
          .map(labelOf)
          .filter((l): l is string => l !== undefined),
      ),
  );
}

describe('a flow’s links', () => {
  it.each(KINDS)('%s: names only its own screens, never a screen from itself', (kind) => {
    const flow = WIREFRAME_FLOWS[kind];
    const names = new Set(flow.screens.map((s) => s.name));
    for (const target of Object.values(flow.links ?? {}))
      expect(target === BACK || names.has(target), `${kind} ${target}`).toBe(true);
    for (const s of flow.screens)
      for (const target of Object.values(s.links ?? {})) {
        expect(target === BACK || names.has(target), `${kind} ${s.name} ${target}`).toBe(true);
        expect(target, `${kind} ${s.name} links to itself`).not.toBe(s.name);
      }
  });

  it.each(KINDS)('%s: finds every control it names', (kind) => {
    const flow = WIREFRAME_FLOWS[kind];
    const screens = buildWireframeFlowScreens(kind);
    flow.screens.forEach((s, i) => {
      for (const control of Object.keys(s.links ?? {}))
        expect(
          findControl(screens[i]!, control),
          `${kind} ${s.name} ${control}`,
        ).toBeGreaterThanOrEqual(0);
    });
    // A flow-wide control is on at least one screen it does not name.
    for (const [control, target] of Object.entries(flow.links ?? {})) {
      const on = flow.screens.filter(
        (s, i) => s.name !== target && findControl(screens[i]!, control) >= 0,
      );
      expect(on.length, `${kind} ${control}`).toBeGreaterThan(0);
    }
  });

  it.each(KINDS)('%s: links every back arrow', (kind) => {
    for (const els of buildWireframeFlowScreens(kind))
      for (const el of els.filter(isBackArrow)) expect(linkOf(el), kind).toBeDefined();
  });

  it.each(KINDS)('%s: reaches every screen from the first', (kind) => {
    const screens = buildWireframeFlowScreens(kind);
    const pages = wireframeFlowPages(kind);
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const at = queue.shift()!;
      for (const el of screens[at]!) {
        const link = linkOf(el);
        if (!link || !isScreenLink(link)) continue;
        const to = resolveScreenLink(link, pages);
        expect(to.state, `${kind} ${labelOf(el)}`).not.toBe('broken');
        if (to.state === 'page' && !seen.has(to.index)) {
          seen.add(to.index);
          queue.push(to.index);
        }
      }
    }
    expect(
      [...seen].sort((a, b) => a - b),
      kind,
    ).toEqual(pages.map((_, i) => i));
  });

  it.each(KINDS)('%s: slides on a phone, tablet or watch and changes at once elsewhere', (kind) => {
    const slide = FLOW_SLIDE_DEVICES.has(WIREFRAME_FLOWS[kind].device);
    const links = buildWireframeFlowScreens(kind)
      .flat()
      .map(linkOf)
      .filter((l): l is ScreenLink => !!l);
    expect(links.length, kind).toBeGreaterThan(0);
    for (const l of links) expect(l.transition, kind).toBe(slide ? 'slide' : undefined);
  });

  it('pressing Continue on a fresh Mobile App Wireframe’s Onboarding goes to Sign In', () => {
    // Built the way an agent's or the api's tab is: the pages the template ships, the links on its elements.
    const tab = buildTemplateTab('t', 'T', 'wireframe-mobile-app');
    const pages = tab.pages!;
    const onboarding = layOutPages(pages)[0]!.rect;
    const cont = tab.elements.find(
      (el) =>
        labelOf(el) === 'Continue' &&
        'x' in el &&
        el.x >= onboarding.x &&
        el.x <= onboarding.x + onboarding.width,
    )!;
    const to = resolveScreenLink(linkOf(cont)!, pages);
    expect(to.state === 'page' && to.page.name).toBe('Sign In');
    expect(linkOf(cont)!.transition).toBe('slide');
  });

  it('every flow’s links resolve on the tab an agent or the api makes', () => {
    for (const kind of KINDS) {
      const tab = buildTemplateTab('t', 'T', kind);
      const links = tab.elements.map(linkOf).filter((l): l is ScreenLink => !!l);
      expect(links.length, kind).toBeGreaterThan(0);
      for (const l of links)
        expect(resolveScreenLink(l, tab.pages!).state, kind).not.toBe('broken');
    }
  });
});

describe('a flow’s own words', () => {
  it.each(KINDS)('%s: changes only words its screens show', (kind) => {
    const flow = WIREFRAME_FLOWS[kind];
    const labels = layoutLabels(kind);
    flow.screens.forEach((s, i) => {
      for (const key of Object.keys(s.copy ?? {}))
        expect(labels[i]!.has(key), `${kind} ${s.name} ${key}`).toBe(true);
    });
    for (const key of Object.keys(flow.copy ?? {}))
      expect(
        labels.some((l) => l.has(key)),
        `${kind} ${key}`,
      ).toBe(true);
    if (flow.brand) {
      const all = buildWireframeFlowScreens(kind).flat().map(labelOf).join('\n');
      expect(all, kind).not.toContain('Your App');
      expect(all, kind).toContain(flow.brand);
    }
  });

  it('reads no screen as another app’s', () => {
    const words = (kind: WireframeFlowKind, screen: string) => {
      const i = WIREFRAME_FLOWS[kind].screens.findIndex((s) => s.name === screen);
      return buildWireframeFlowScreens(kind)[i]!.map(labelOf).join(' | ');
    };
    expect(words('wireframe-travel-app', 'Results')).not.toContain('Linen');
    expect(words('wireframe-music-app', 'Browse')).not.toContain('Photos');
    expect(words('wireframe-music-app', 'Search')).not.toContain('Shirt');
    expect(words('wireframe-video-app', 'Search')).not.toContain('Shirt');
    expect(words('wireframe-ride-app', 'Updates')).not.toContain('liked your photo');
    expect(words('wireframe-watch-music', 'Up Next')).not.toContain('Design Review');
    expect(words('wireframe-mobile-app', 'Product')).not.toContain('Product Name');
    expect(words('wireframe-music-app', 'Podcast')).not.toMatch(/Oct -/);
  });

  it('gives a repeated word the flow’s words in turn, the rest keeping the last, and the brand in place', () => {
    const t = (label: string): Element => ({ ...createText(0, 0), label });
    const out = relabelScreen(
      [
        t('a'),
        t('a'),
        t('a'),
        t('Sign in to Your App'),
        { ...createShape('icon', 0, 0), iconId: 'x' },
      ],
      { a: ['one', 'two'] },
      'Hop',
    );
    expect(out.map(labelOf)).toEqual(['one', 'two', 'two', 'Sign in to Hop', undefined]);
  });

  it('drops a relabelled text’s runs and leaves an unchanged one as it was', () => {
    const rich = { ...createText(0, 0), label: 'a', richText: [{ text: 'a' }] } as Element;
    const same = { ...createText(0, 0), label: 'b' };
    const [changed, kept] = relabelScreen([rich, same], { a: 'z' }, undefined);
    expect(changed).not.toHaveProperty('richText');
    expect(labelOf(changed!)).toBe('z');
    expect(kept).toBe(same);
  });
});

describe('linkScreen', () => {
  const flow = WIREFRAME_FLOWS['wireframe-website'];
  const t = (label: string): Element => ({ ...createText(0, 0), label });

  it('skips a control it cannot find, a screen it cannot name and its own screen', () => {
    const els = [t('Go'), t('Here')];
    const out = linkScreen(els, { Missing: 'Pricing', Go: 'Nowhere', Here: 'Home' }, flow, 0);
    expect(out.map(linkOf)).toEqual([undefined, undefined]);
  });

  it('links the first control of its words, to a page or back, changing at once in a browser', () => {
    const out = linkScreen([t('Go'), t('Go'), t('Back')], { Go: 'Pricing', Back: BACK }, flow, 0);
    expect(out.map(linkOf)).toEqual([
      { kind: 'page', pageId: 'page-2' },
      undefined,
      { kind: 'back' },
    ]);
  });
});
