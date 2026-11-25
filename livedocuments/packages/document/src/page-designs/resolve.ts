// Which design each page wears, and how (docs/specs/011-theme/blueprints/page-designs.md "Resolution"): its own
// override over the tab's, its role (title, section or content) for the tab's rhythm, and its place in a flowing
// strip. Pure.
import type { Element } from '../index';
import type { LaidOutPage } from '../page';
import { PAGE_DESIGN_BY_ID } from './catalogue';
import { isNoDesign, resolveTuning, type DesignTuning, type PageDesign } from './tuning';
import type { DesignStrip } from './render';

export const RHYTHM_QUIET_INTENSITY = 0.55;
export const RHYTHM_QUIET_CALM = 0.7;
export const SECTION_TEXTS_MAX = 3;

export type PageDesignRole = 'title' | 'section' | 'content';

export type ResolvedPageDesign = {
  design: PageDesign;
  tuning: DesignTuning;
  role: PageDesignRole;
  // Whether it is the tab's design (else the page's own).
  fromTab: boolean;
  strip?: DesignStrip;
};

type PageLike = Pick<LaidOutPage, 'id' | 'design' | 'rect' | 'index'>;

/** Elements by the page holding their centre (pages lie in one row, so a page's x range finds it). */
function elementsByPage(
  pages: readonly PageLike[],
  elements: readonly Element[],
): Map<string, Element[]> {
  const out = new Map<string, Element[]>();
  for (const el of elements) {
    if (!('width' in el) || typeof el.x !== 'number') continue;
    const box = el as unknown as { x: number; y: number; width: number; height: number };
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const page = pages.find(
      (p) =>
        cx >= p.rect.x &&
        cx <= p.rect.x + p.rect.width &&
        cy >= p.rect.y &&
        cy <= p.rect.y + p.rect.height,
    );
    if (!page) continue;
    const list = out.get(page.id);
    if (list) list.push(el);
    else out.set(page.id, [el]);
  }
  return out;
}

/** A page's role: the first page is the title, a page of one to three texts alone a section page. */
export function pageDesignRole(
  index: number,
  onPage: readonly Element[] | undefined,
): PageDesignRole {
  if (index === 0) return 'title';
  if (
    onPage &&
    onPage.length >= 1 &&
    onPage.length <= SECTION_TEXTS_MAX &&
    onPage.every((el) => el.type === 'text')
  )
    return 'section';
  return 'content';
}

/** The tuning a role draws with: a quiet content page under the tab's rhythm. */
export function tuningForRole(t: DesignTuning, role: PageDesignRole): DesignTuning {
  if (!t.rhythm || role !== 'content') return t;
  return {
    ...t,
    intensity: Math.max(0.1, t.intensity * RHYTHM_QUIET_INTENSITY),
    calm: Math.max(t.calm, RHYTHM_QUIET_CALM),
  };
}

/** Every page's design, by page id; a page wearing none is absent. `elements` gives the roles (only read with rhythm). */
export function resolvePageDesigns(
  tabDesign: PageDesign | undefined,
  pages: readonly PageLike[],
  elements: readonly Element[] = [],
): Map<string, ResolvedPageDesign> {
  const out = new Map<string, ResolvedPageDesign>();
  const tabTuning = tabDesign && resolveTuning(tabDesign);
  const needsRoles =
    !!tabTuning?.rhythm || pages.some((p) => p.design && !isNoDesign(p.design) && p.design.rhythm);
  const byPage = needsRoles ? elementsByPage(pages, elements) : undefined;
  for (const page of pages) {
    const own = page.design;
    if (isNoDesign(own)) continue;
    const design = own ?? tabDesign;
    if (!design) continue;
    const base = own ? resolveTuning(own) : tabTuning!;
    const role = pageDesignRole(page.index, byPage?.get(page.id));
    out.set(page.id, { design, tuning: tuningForRole(base, role), role, fromTab: !own });
  }
  // Flow: runs of consecutive pages wearing the tab design make a strip.
  if (tabDesign && tabTuning?.flow && PAGE_DESIGN_BY_ID[tabDesign.id].flows) {
    let run: PageLike[] = [];
    const close = () => {
      const span = run.reduce((sum, p) => sum + p.rect.width, 0);
      let x = 0;
      for (const p of run) {
        const r = out.get(p.id)!;
        if (run.length > 1) r.strip = { x, span };
        x += p.rect.width;
      }
      run = [];
    };
    for (const page of pages) {
      if (out.get(page.id)?.fromTab) run.push(page);
      else close();
    }
    close();
  }
  return out;
}
