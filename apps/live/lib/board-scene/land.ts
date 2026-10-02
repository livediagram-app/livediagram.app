// The board scene landing (docs/specs/020-import-export/board-scene.md): one pure function that
// turns a scene from any source into elements for a tab's profile, with fresh ids, the image
// requests, the tab's patch and the report. Never throws: a scene too big for the tab is a named
// rejection, an unusable item a counted skip.
import {
  MAX_ELEMENTS_PER_TAB,
  WHITEBOARD_DEFAULT_PATTERN,
  type BackgroundPattern,
  type Element,
} from '@livediagram/document';
import type { ImportImageRequest } from '@/lib/import-images';
import { createLandContext, LANDING_RULES, type LandContext } from './context';
import { landFrame, landImage, landShape, landSticky, landText } from './land-boxes';
import { landArrow } from './land-connectors';
import { diagramFreehand, diagramShape, diagramSticky, diagramText } from './land-diagram';
import { landInk, landLine, landPath } from './land-marks';
import { placementOffset, translateItem, type BoardScenePlacement } from './placement';
import { mergeNotes, type BoardSceneReport } from './report';
import { compactLanded } from './compact';
import type { BoardScene, SceneAsset, SceneItem, SceneItemKind, ScenePolyline } from './scene';
import { debugLog } from '@/lib/debug-log';

export type { BoardScenePlacement } from './placement';
export type { BoardSceneReport } from './report';

// A landed whiteboard's name when its scene has no title: the template's own.
export const SCENE_DEFAULT_TITLE = 'Whiteboard';

export type BoardSceneProfile = 'whiteboard' | 'diagram';
export type LandOptions = {
  profile: BoardSceneProfile;
  placement: BoardScenePlacement;
  mintId: () => string;
  /** Elements the target tab can still take; absent: a whole tab's worth. */
  room?: number;
};
export type BoardSceneTabPatch = {
  kind?: 'whiteboard';
  name: string;
  backgroundPattern?: BackgroundPattern;
  backgroundColor?: string;
};
export type LandedBoardScene = {
  elements: Element[];
  imageRequests: ImportImageRequest[];
  report: BoardSceneReport;
  tabPatch: BoardSceneTabPatch;
};
export type BoardSceneRejection = 'too-many-elements';
export type LandResult =
  | ({ ok: true } & LandedBoardScene)
  | { ok: false; rejection: BoardSceneRejection; message: string };

const PATTERNS: Readonly<Record<'plain' | 'dots' | 'grid', BackgroundPattern>> = {
  plain: 'blank',
  dots: 'grid',
  grid: 'graph',
};

const finite = (...ns: number[]) => ns.every(Number.isFinite);

// Whether an item has geometry to land: finite coordinates, enough points, a real box.
function usable(item: SceneItem): boolean {
  if ('points' in item) {
    const min = item.kind === 'ink' ? 1 : 2;
    return item.points.length >= min && item.points.every((p) => finite(p.x, p.y));
  }
  return finite(item.x, item.y, item.width, item.height) && item.width > 0 && item.height > 0;
}

// The kinds whose ends may pin to other items, landed once every box has.
function isArrowItem(item: SceneItem, profile: BoardSceneProfile): boolean {
  if (item.kind === 'connector') return true;
  if (item.kind !== 'polyline') return false;
  const headed = !!(item.heads?.start || item.heads?.end);
  return headed || (profile === 'diagram' && item.points.length === 2);
}

type Landed = { element: Element; request?: ImportImageRequest } | null;

function landBox(
  item: Exclude<SceneItem, { kind: 'connector' }>,
  id: string,
  ctx: LandContext,
  profile: BoardSceneProfile,
  assets: ReadonlyMap<string, SceneAsset>,
): Landed {
  const whiteboard = profile === 'whiteboard';
  const wrap = (element: Element | null): Landed => (element ? { element } : null);
  switch (item.kind) {
    case 'ink':
      return wrap(whiteboard ? landInk(item, id, ctx) : diagramFreehand(item, id, ctx));
    case 'polyline':
      return wrap(
        !whiteboard
          ? diagramFreehand(item, id, ctx)
          : item.points.length === 2
            ? landLine(item as ScenePolyline, id, ctx)
            : landPath(item, id, ctx),
      );
    case 'shape':
      return wrap(whiteboard ? landShape(item, id, ctx) : diagramShape(item, id, ctx));
    case 'text': {
      const text = whiteboard ? landText(item, id, ctx) : diagramText(item, id, ctx);
      if (!text) ctx.skip(LANDING_RULES.emptyText);
      return wrap(text);
    }
    case 'sticky':
      return wrap(whiteboard ? landSticky(item, id, ctx) : diagramSticky(item, id, ctx));
    case 'image': {
      const { element, request } = landImage(item, id, ctx, assets);
      return { element, request };
    }
    case 'frame':
      return wrap(landFrame(item, id, ctx));
  }
}

function tabPatchOf(scene: BoardScene, profile: BoardSceneProfile): BoardSceneTabPatch {
  const name = scene.title?.trim() || SCENE_DEFAULT_TITLE;
  if (profile === 'whiteboard') {
    const pattern = scene.background?.pattern;
    return {
      kind: 'whiteboard',
      name,
      backgroundPattern: pattern ? PATTERNS[pattern] : WHITEBOARD_DEFAULT_PATTERN,
    };
  }
  const colour = scene.background?.colour?.hex;
  return { name, ...(colour ? { backgroundColor: colour } : {}) };
}

export function landBoardScene(scene: BoardScene, options: LandOptions): LandResult {
  const room = options.room ?? MAX_ELEMENTS_PER_TAB;
  if (scene.items.length > room) {
    debugLog('[board-scene] rejected', {
      rejection: 'too-many-elements',
      items: scene.items.length,
      room,
    });
    return {
      ok: false,
      rejection: 'too-many-elements',
      message: `This board has more than the ${MAX_ELEMENTS_PER_TAB.toLocaleString('en-GB')} elements a tab can hold.`,
    };
  }
  const { profile, mintId } = options;
  const ctx = createLandContext();
  const assets = new Map<string, SceneAsset>();
  for (const asset of scene.assets) if (!assets.has(asset.key)) assets.set(asset.key, asset);

  const items = scene.items.filter((item) => {
    if (usable(item)) return true;
    ctx.skip(LANDING_RULES.unsized);
    return false;
  });
  const { dx, dy } = placementOffset(items, options.placement);
  const placed = items.map((item) => translateItem(item, dx, dy));

  // Boxes first, so arrows can pin to them; every slot keeps the scene's order.
  const slots: (Element | null)[] = new Array(placed.length).fill(null);
  const byKey = new Map<string, Element>();
  const imageRequests: ImportImageRequest[] = [];
  const landedKinds = new Array<SceneItemKind | null>(placed.length).fill(null);
  placed.forEach((item, i) => {
    if (item.kind === 'connector' || isArrowItem(item, profile)) return;
    const out = landBox(item, mintId(), ctx, profile, assets);
    if (!out) return;
    slots[i] = out.element;
    landedKinds[i] = item.kind;
    if (out.request) imageRequests.push(out.request);
    if (!byKey.has(item.key)) byKey.set(item.key, out.element);
  });
  placed.forEach((item, i) => {
    if (item.kind !== 'connector' && !isArrowItem(item, profile)) return;
    slots[i] = landArrow(
      item as SceneItem & { kind: 'connector' | 'polyline' },
      mintId(),
      ctx,
      byKey,
      profile,
    );
    landedKinds[i] = item.kind;
  });

  const landed: BoardSceneReport['landed'] = {};
  for (const kind of landedKinds) if (kind) landed[kind] = (landed[kind] ?? 0) + 1;
  const report: BoardSceneReport = { landed, ...mergeNotes([...scene.notes, ...ctx.notes()]) };
  const elements = compactLanded(slots.filter((el): el is Element => el !== null));
  debugLog('[board-scene] landed', {
    source: scene.source,
    profile,
    placement: options.placement.kind,
    items: scene.items.length,
    landed,
    degraded: report.degraded,
    skipped: report.skipped,
  });
  for (const rule of report.skipped) debugLog('[board-scene] skipped', rule);
  return { ok: true, elements, imageRequests, report, tabPatch: tabPatchOf(scene, profile) };
}
