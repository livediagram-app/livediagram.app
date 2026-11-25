// Saved designs in the Page Design picker (docs/specs/011-theme/page-designs.md "Saved designs"): the Library's
// items of the saved design kind, each with its design (read from its preview), whose it is and whether this person
// may tidy it; and what Save This Design hands the Library. Pure.
import {
  PAGE_DESIGN_BY_ID,
  SAVED_DESIGN_HEIGHT,
  SAVED_DESIGN_WIDTH,
  compactPageDesign,
  designFromPreview,
  parsePageDesign,
  samePageDesign,
  savedDesignElement,
  type PageDesign,
} from '@livedocuments/document';
import type { LibraryItemSummary, LibraryTeam } from '@liveworkspace/media';
import type { LibrarySaveDraft } from '@liveworkspace/workbench/components/library/LibraryProvider';

export const MY_WORK = 'My Work';

export type SavedDesign = {
  item: LibraryItemSummary;
  design: PageDesign;
  // My Work, or the team's name.
  whose: string;
  // Rename and Delete: its owner's for My Work, a team's admins' for a team's (the Library's rule).
  tidy: boolean;
};

/** The saved designs a list holds, newest first; an item whose design can't be read is left out. */
export function savedDesignsOf(
  items: readonly LibraryItemSummary[],
  teams: readonly LibraryTeam[],
): SavedDesign[] {
  const team = new Map(teams.map((t) => [t.id, t]));
  const out: SavedDesign[] = [];
  for (const item of items) {
    const design = designFromPreview(item.preview);
    if (!design) continue;
    const t = item.teamId ? team.get(item.teamId) : undefined;
    out.push({
      item,
      design,
      whose: item.scope === 'personal' ? MY_WORK : (t?.name ?? 'A team'),
      tidy: item.scope === 'personal' || t?.role === 'admin',
    });
  }
  return out.sort((a, b) => b.item.createdAt - a.item.createdAt);
}

// A design as stored, so two read different ways compare alike; a page's own without the tab's switches.
function canonical(design: PageDesign, onPage: boolean): PageDesign | undefined {
  const { rhythm, flow, ...own } = design;
  const parsed = parsePageDesign(onPage ? own : { ...own, rhythm, flow });
  return parsed && compactPageDesign(parsed);
}

/** Whether the tab (or, on This Page, the page) wears this saved design as saved: its tile shows selected. */
export function wearsSaved(
  worn: PageDesign | undefined,
  saved: PageDesign,
  onPage: boolean,
): boolean {
  return worn !== undefined && samePageDesign(canonical(worn, onPage), canonical(saved, onPage));
}

/** What Save This Design hands the Library: the design as tuned, named after it to start with. */
export function saveDraftOf(design: PageDesign): LibrarySaveDraft {
  return {
    width: SAVED_DESIGN_WIDTH,
    height: SAVED_DESIGN_HEIGHT,
    elements: [savedDesignElement(design)],
    suggestedTitle: `${PAGE_DESIGN_BY_ID[design.id].label}, tuned`,
    copy: {
      title: 'Save This Design',
      subtitle: 'Keep this design as it is tuned, to use on any page of any document.',
      placeholder: 'Name this design',
      personalLabel: MY_WORK,
      verb: 'use it',
    },
  };
}
