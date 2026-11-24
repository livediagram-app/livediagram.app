// Saved Page Designs for agents (docs/specs/011-theme/page-designs.md "Agents"): the designs saved to the caller's
// Library and their teams', as the api lists them, and the `saved:<id>` a change names one by, swapped for the design
// with its tuning before the change is sent. The list is asked for only when a change names a saved design.
import type { ApiClient } from '@liveworkspace/api-client';
import type {
  PageChange,
  SavedPageDesign,
  SavedPageDesignsResponse,
} from '@livedocuments/api-schema';
import { savedDesignId, type PageDesign } from '@livedocuments/document';

export const SAVED_DESIGNS_PATH = '/page-designs';

/** The caller's saved designs; none when this server keeps no Library (it answers 503). */
export async function savedDesigns(api: ApiClient): Promise<SavedPageDesign[]> {
  try {
    const { designs } = await api.json<Partial<SavedPageDesignsResponse>>(SAVED_DESIGNS_PATH);
    return Array.isArray(designs) ? designs : [];
  } catch (err) {
    if ((err as { status?: number }).status === 503) return [];
    throw err;
  }
}

// A page's own design takes no rhythm or flow (the tab design's).
function pageOwn(design: PageDesign): PageDesign {
  const { rhythm: _rhythm, flow: _flow, ...own } = design;
  return own;
}

export type SavedDesignRefusal = { ok: false; code: string; message: string; change: number };

/** The changes with every `saved:<id>` swapped for its design, or the first one the caller can't see. */
export async function withSavedDesigns(
  api: ApiClient,
  changes: readonly PageChange[],
): Promise<{ ok: true; changes: PageChange[] } | SavedDesignRefusal> {
  const named = changes.some(
    (c) => 'design' in c && c.design !== undefined && savedDesignId(c.design) !== null,
  );
  if (!named) return { ok: true, changes: [...changes] };
  const list = await savedDesigns(api);
  const byId = new Map(list.map((d) => [d.id, d.design]));
  const out: PageChange[] = [];
  for (const [i, change] of changes.entries()) {
    const id = 'design' in change ? savedDesignId(change.design) : null;
    if (id === null) {
      out.push(change);
      continue;
    }
    const design = byId.get(`saved:${id}`);
    if (!design) {
      const known = list.map((d) => `${d.id} (${d.title})`).join(', ');
      return {
        ok: false,
        code: 'design_unknown',
        change: i,
        message: `No saved design "saved:${id}". ${known ? `Saved designs: ${known}.` : 'Nothing is saved to your Library or your teams’.'}`,
      };
    }
    out.push(
      change.op === 'tab_design'
        ? { ...change, design }
        : ({ ...change, design: pageOwn(design) } as PageChange),
    );
  }
  return { ok: true, changes: out };
}
