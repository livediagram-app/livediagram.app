// Step 3 of the splitter (split.ts): each draft's elements settled for its app. Tab fields the app doesn't read go,
// links are pointed at where their targets went, and references another app now holds are frozen into picture slots.
import type { CrossReference, MigrationApp, SplitHooks } from './contract';
import {
  CHART_SHEET_FIELDS,
  isArticleNote,
  isPlanShape,
  isRec,
  isTabWindow,
  num,
  ownItemLink,
  PAGES_FIELDS,
  PLAN_FIELDS,
  str,
  type Draft,
  type Rec,
  type Source,
} from './split-model';

/** What settling reads from the core: the parts, their addresses and the notes and cross references it adds to. */
export type SettleContext = {
  src: Source;
  hooks: SplitHooks;
  keeper: MigrationApp;
  partIds: Map<MigrationApp, string>;
  note: (text: string) => void;
  crossReferences: CrossReference[];
  resolveTab: (
    oldTabId: string,
    fromApp: MigrationApp,
    elementId?: string,
  ) => { app: MigrationApp; tabId: string } | null;
  urlLink: (app: MigrationApp, tabId: string | null) => { kind: string; url: string };
  partUrl: (app: MigrationApp, id: string, tabId: string | null) => string;
  hasPlanner: boolean;
  sheetTab: Map<string, string>;
  plannerTabs: Set<string>;
};

export function makeSettle({
  src,
  hooks,
  keeper,
  partIds,
  note,
  crossReferences,
  resolveTab,
  urlLink,
  partUrl,
  hasPlanner,
  sheetTab,
  plannerTabs,
}: SettleContext): (draft: Draft) => Rec | null {
  return (draft: Draft): Rec | null => {
    const body = draft.body;
    if (!body) return null;
    const app = draft.app;
    const at = (elementId: string) => ({ app, id: partIds.get(app)!, tabId: draft.id, elementId });
    const tag = `tab ${draft.source.id}${draft.split ? ` (${app} half)` : ''}`;
    let out = body;
    const set = (k: string, v: unknown) => {
      if (out === body) out = { ...body };
      if (v === undefined) delete out[k];
      else out[k] = v;
    };

    // Tab fields the app doesn't read.
    if (app === 'livediagram') {
      const pages = Array.isArray(body.pages) ? body.pages.length : 0;
      for (const k of PAGES_FIELDS) if (k in body) set(k, undefined);
      if (pages > 0)
        note(
          `${tag}: ${pages} page(s) kept from an earlier Pages mode dropped (a Diagram tab has none)`,
        );
    }
    if (app !== 'liveplanner') {
      for (const k of PLAN_FIELDS) {
        if (k in body) {
          set(k, undefined);
          note(`${tag}: its ${k} dropped (only a Plan tab has one)`);
        }
      }
    }
    if ((app === 'livedocuments' || app === 'livedesign') && body.opensIn !== 'pages')
      set('opensIn', 'pages');

    const link = (value: unknown, elementId: string): unknown => {
      if (!isRec(value)) return value;
      if (value.kind === 'tab' || value.kind === 'element') {
        const tabId = str(value.tabId);
        if (!tabId) return value;
        const target = resolveTab(
          tabId,
          app,
          value.kind === 'element' ? str(value.elementId) : undefined,
        );
        if (!target) return value;
        if (target.app === app)
          return target.tabId === tabId ? value : { ...value, tabId: target.tabId };
        crossReferences.push({
          from: at(elementId),
          to: { app: target.app, id: partIds.get(target.app)!, tabId: target.tabId },
          kind: 'link',
        });
        return urlLink(target.app, target.tabId);
      }
      if (value.kind === 'document' || value.kind === 'design' || value.kind === 'project') {
        const documentId = str(value.documentId) ?? str(value.designId) ?? str(value.projectId);
        if (!documentId) return value;
        const name = str(value.name) ?? '';
        if (documentId === src.id) {
          // A link to this very document: to whichever part kept its id (the browser's own copy when Local only).
          if (keeper === app) return ownItemLink(app, partIds.get(app)!, name);
          crossReferences.push({
            from: at(elementId),
            to: { app: keeper, id: partIds.get(keeper)!, tabId: null },
            kind: 'link',
          });
          return urlLink(keeper, null);
        }
        const target = hooks.keptByOf?.(documentId) ?? 'livediagram';
        if (target === app) {
          const own = ownItemLink(app, documentId, name);
          return own.kind === value.kind ? value : own;
        }
        return { kind: 'url', url: partUrl(target, documentId, null) };
      }
      return value;
    };

    // A frozen reference: the element becomes a picture slot (an image with no image yet, which every app draws as
    // a placeholder until the migrate tool draws the picture in) linking to where the content went.
    const freeze = (
      el: Rec,
      kind: CrossReference['kind'],
      to: { app: MigrationApp; tabId: string | null },
      picture: { tabId: string; elementId: string | null },
    ): Rec => {
      const id = el.id as string;
      const slot: Rec = {
        id,
        type: 'image',
        x: num(el.x, 0),
        y: num(el.y, 0),
        width: num(el.width, 640),
        height: num(el.height, 360),
        imageId: null,
        objectFit: 'contain',
        // Within the part, an ordinary tab link; to another app, its address.
        link:
          to.app === app && to.tabId ? { kind: 'tab', tabId: to.tabId } : urlLink(to.app, to.tabId),
      };
      for (const k of ['layerId', 'rotation', 'locked', 'opacity'] as const) {
        if (el[k] !== undefined) slot[k] = el[k];
      }
      if (typeof el.label === 'string' && el.label) slot.alt = el.label;
      crossReferences.push({
        from: at(id),
        to: { app: to.app, id: partIds.get(to.app)!, tabId: to.tabId },
        kind,
        picture,
      });
      return slot;
    };

    const elements = Array.isArray(body.elements) ? (body.elements as unknown[]) : null;
    if (elements) {
      let next: unknown[] | null = null;
      for (let i = 0; i < elements.length; i++) {
        const el0 = elements[i];
        if (!isRec(el0) || typeof el0.id !== 'string') {
          if (next) next.push(el0);
          continue;
        }
        const id = el0.id;
        let el: Rec | null = el0;

        if (isTabWindow(el)) {
          const shown = str(el.windowTabId);
          const target = shown ? resolveTab(shown, app) : null;
          if (target && target.app === app && app !== 'livediagram') {
            if (target.tabId !== shown) el = { ...el, windowTabId: target.tabId };
          } else if (target && shown) {
            el = freeze(el, 'tab-window', target, { tabId: shown, elementId: null });
          } else if (app === 'livediagram') {
            el = null;
            note(`${tag}: a tab window onto no tab dropped`);
          }
        } else if (isPlanShape(el)) {
          if (app !== 'liveplanner') {
            if (hasPlanner) {
              const sheetId = isRec(el.planSheet) ? str(el.planSheet.sheetId) : undefined;
              const sheetOn = sheetId ? sheetTab.get(sheetId) : undefined;
              const tabId = sheetOn && plannerTabs.has(sheetOn) ? sheetOn : null;
              el = freeze(
                el,
                'plan-element',
                { app: 'liveplanner', tabId },
                { tabId: draft.source.id, elementId: id },
              );
            } else {
              el = null;
              note(`${tag}: a ${String(el0.shape)} with no Plan data behind it dropped`);
            }
          }
        } else if (isArticleNote(el) && app !== 'livedocuments') {
          el = null;
          note(`${tag}: an article margin note dropped (only livedocuments has articles)`);
        }

        if (el && (el.chartSource !== undefined || el.sheetAnchor !== undefined)) {
          const sheetId = isRec(el.chartSource) ? str(el.chartSource.sheetId) : undefined;
          const sheetOn = sheetId ? sheetTab.get(sheetId) : undefined;
          const readable = !!sheetOn && plannerTabs.has(sheetOn);
          if (app !== 'liveplanner' || (el.chartSource !== undefined && !readable)) {
            // The chart keeps its last read values as its own (as livediagram's read does) and links to its sheet.
            const kept: Rec = { ...el };
            for (const k of CHART_SHEET_FIELDS) delete kept[k];
            if (readable && hasPlanner) {
              crossReferences.push({
                from: at(id),
                to: { app: 'liveplanner', id: partIds.get('liveplanner')!, tabId: sheetOn },
                kind: 'chart-source',
              });
              if (kept.link === undefined) kept.link = urlLink('liveplanner', sheetOn);
            } else if (el.chartSource !== undefined) {
              note(`${tag}: chart ${id} read a sheet that didn't move; it keeps its last values`);
            }
            el = kept;
          }
        }

        if (el && el.link !== undefined) {
          const l = link(el.link, id);
          if (l !== el.link) el = { ...el, link: l };
        }
        if (el && el.type === 'table' && Array.isArray(el.cellStyles)) {
          let rows: unknown[] | null = null;
          (el.cellStyles as unknown[]).forEach((row, r) => {
            if (!Array.isArray(row)) return;
            let cells: unknown[] | null = null;
            row.forEach((cell: unknown, c: number) => {
              if (!isRec(cell) || cell.link === undefined) return;
              const l = link(cell.link, id);
              if (l === cell.link) return;
              cells ??= row.slice();
              cells[c] = { ...cell, link: l };
            });
            if (cells) {
              rows ??= (el!.cellStyles as unknown[]).slice();
              rows[r] = cells;
            }
          });
          if (rows) el = { ...el, cellStyles: rows };
        }

        if (el !== el0 && !next) next = elements.slice(0, i);
        if (next && el) next.push(el);
      }
      if (next) set('elements', next);
    }
    return out;
  };
}
