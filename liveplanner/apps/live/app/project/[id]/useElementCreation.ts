import { dashboardItemOf, placeOnDashboard } from '@/hooks/plan/dashboard-drop';
import { planBoardPlacement } from '@/lib/plan-board-placement';
import { isPlanViewId, planViewSize } from '@liveplanner/items';
import type { Selection } from '@/lib/selection-store';
import { type Dispatch, type SetStateAction } from 'react';
import {
  acceptsInlineIcon,
  createAnnotation,
  type EmbedProvider,
  applyShapeVariant,
  withInlineIcon,
  createShape,
  defaultIconAnimation,
  createText,
  type BoxedElement,
  type Element,
  defaultSessionConfig,
  type SessionTool,
  type ShapeKind,
  type Tab,
  withVariantColours,
} from '@liveplanner/project';
import { getTechIcon, isTechIconId } from '@/lib/tech-icons';
import { buildDrawnBoxed } from '@/lib/draw-commit';
import { getSticker, stickerDropSize } from '@/lib/stickers';
import { track, titleCaseType } from '@/lib/telemetry';
import type { AddShapeOptions, PendingDraw } from '@/lib/draw-mode';
import { useArrowConnect } from '@/app/project/[id]/useArrowConnect';
import {
  BLANK_SHEET_CHOICE,
  isPlacedSheetStart,
  placeNewSheet,
  sheetTitleForTab,
} from '@/lib/sheet-seeds';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Palette element-creation handlers, lifted out of editor-page.tsx. Nearly
// every element arms the combined add gesture (beginDraw, from
// useShapeDrawing) — the canvas then drops it at default size on a tap or
// sizes it on a drag. The ANNOTATION alone drops at the viewport centre via
// addBoxed (from useElementHelpers): a fixed 44x44 marker has no box to size,
// so there is nothing for the drag to decide (docs/specs/008-canvas/canvas-and-palette.md "Placement on add").

// A plan view placed from the palette (docs/specs/026-plan/plan-views.md): its tile's view, at its size.
function planViewPlacement(view: string | undefined) {
  return {
    ...(isPlanViewId(view) ? { planView: { view } } : {}),
    ...planViewSize(view),
  };
}

export function useElementCreation(opts: {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  // The single-selected element id, so "add an icon" can drop it INSIDE
  // a selected shape instead of creating a standalone icon element.
  // Read where an add acts on the selection (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  addBoxed: <T extends BoxedElement>(make: (x: number, y: number) => T) => void;
  addBoxedAt: <T extends BoxedElement>(
    canvasX: number,
    canvasY: number,
    make: (x: number, y: number) => T,
    opts?: {
      edit?: boolean;
      style?: <E extends BoxedElement>(el: E) => E;
    },
  ) => void;
  beginDraw: (intent: PendingDraw) => void;
  // Style memory (docs/specs/008-canvas/quick-style-panel.md) for the user-drawn adds made here: a palette
  // drop and a click-to-connect arrow.
  styleNewElement: <T extends Element>(el: T) => T;
  // A palette card never lands on the canvas (docs/specs/026-plan/plan-mode.md "The palette"): it goes
  // into the board column at the point, or nowhere.
  onPlanCardPlace?: (itemType: string | undefined, canvasX: number, canvasY: number) => void;
}) {
  const {
    editsBlocked,
    activeId,
    activeTab,
    readSelection,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxed,
    addBoxedAt,
    beginDraw,
    styleNewElement,
    onPlanCardPlace,
  } = opts;

  // Telemetry for these arming handlers fires on commit (see
  // useShapeDrawing.commitDraw), once the tap / drag actually lands the
  // element — not here, where the gesture is only queued.
  // `opts` carries a creation-time choice for the kinds that have one: which
  // session tool (docs/specs/012-collaboration/session-button.md). The palette offers a
  // tile per choice, so it has to survive the draw gesture and land on the
  // element rather than leaving the factory default in place.
  const addShape = (kind: ShapeKind, opts?: AddShapeOptions) => {
    if (editsBlocked) return;
    // On a Dashboard a plan view, board or Sheet fills a slot (hooks/plan/dashboard-drop.ts).
    if (placeOnDashboard(dashboardItemOf(kind, opts?.plan))) return;
    beginDraw({
      type: 'shape',
      kind,
      ...(opts?.plan ? { plan: opts.plan } : {}),
      ...(opts?.session ? { session: opts.session } : {}),
      ...(opts?.variant ? { variant: opts.variant } : {}),
      ...(opts?.name ? { name: opts.name } : {}),
    });
  };

  // Curated icon glyph. Unlike addShape it drops straight at the
  // viewport centre (no draw-to-size: an icon is a fixed-aspect glyph,
  // not a box you size by dragging) and carries the chosen iconId.
  const addIcon = (iconId: string) => {
    if (editsBlocked) return;
    // If a regular shape is selected, drop the icon INSIDE it (beside the
    // label) rather than spawning a standalone icon element — the same
    // "operate on the current selection" intent the size-inheritance in
    // addBoxed already follows. `acceptsInlineIcon` excludes the dedicated
    // 'icon' shape (an icon-on-an-icon is meaningless) AND frames (a frame
    // is a container — an icon dropped with a frame selected becomes a
    // standalone element you place inside it, see docs/specs/009-elements/annotations.md).
    const { selectedId } = readSelection();
    const sel = selectedId ? activeTab.elements.find((e) => e.id === selectedId) : null;
    if (sel && acceptsInlineIcon(sel)) {
      commitTabs((ts) =>
        ts.map((t) =>
          t.id !== activeId
            ? t
            : {
                ...t,
                // Spread the LIVE element, not the render-time `sel`
                // closure — writing `sel` back would clobber any change
                // that landed on this element since the render.
                elements: t.elements.map((e) =>
                  e.id === sel.id ? withInlineIcon(e, iconId, sel.iconPosition ?? 'left') : e,
                ),
              },
        ),
      );
      // Reuse Added/Icon — an icon was placed; `type` stays the kind,
      // never the specific iconId, to keep telemetry free of content.
      track('Element', 'Added', titleCaseType('icon'));
      return;
    }
    // Standalone icon: arm a draw-to-size gesture (tap to drop, drag to
    // size) just like a shape, carrying the glyph id. Telemetry fires on
    // commit (see useShapeDrawing.commitDraw).
    beginDraw({ type: 'shape', kind: 'icon', iconId });
  };

  // Sticker (docs/specs/010-palette/stickers.md). Its own shape kind, so unlike addIcon there is no
  // "fold into the selected shape" branch: a sticker never becomes another
  // element's inline glyph, it lands as a sticker wherever it is dropped.
  // Telemetry fires on commit (see useShapeDrawing.commitDraw).
  const addSticker = (stickerId: string) => {
    if (editsBlocked) return;
    beginDraw({ type: 'shape', kind: 'sticker', stickerId });
  };

  // Technology (brand) icon (docs/specs/010-palette/technology-icons.md). Reuses the 'icon' shape kind but is
  // ALWAYS a standalone element — never dropped inside a selected shape as
  // an inline icon (a coloured brand tile beside a shape's text is not
  // meaningful, and the inline-icon renderer only knows line-art prims). The
  // distinct 'TechIcon' telemetry type separates architecture-icon usage
  // from line-art icons while reusing the closed Element/Added pair.
  const addTechIcon = (iconId: string) => {
    if (editsBlocked) return;
    // Seed the label with the catalogue name (e.g. "S3", "EKS") so the icon
    // lands self-describing; the user can clear / rename it like any label.
    // Arm a draw-to-size gesture (tap to drop, drag to size) like a shape;
    // telemetry fires on commit (see useShapeDrawing.commitDraw).
    const label = getTechIcon(iconId)?.label ?? '';
    beginDraw({ type: 'shape', kind: 'icon', iconId, label });
  };

  // A 3x3 table, drawn to size like a shape. It used to drop at the viewport
  // centre on the reasoning that "the grid sizes itself" — but the grid
  // divides whatever box it is given, so the box was always the user's to
  // choose and they were made to resize it afterwards instead.
  // Telemetry fires on commit (see useShapeDrawing.commitDraw).
  const addTable = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'table' });
  };

  // A note marker (docs/specs/009-elements/annotations.md) dropped at the viewport centre (no
  // draw-to-size: it's a fixed-size marker, not a box you drag out). The
  // user clicks it afterwards to add the note text.
  const addAnnotation = () => {
    if (editsBlocked) return;
    addBoxed((x, y) => createAnnotation(x, y));
    track('Element', 'Added', titleCaseType('annotation'));
  };

  // A link-card / bookmark (docs/specs/009-elements/link-cards.md), drawn to size. The card starts empty
  // ("double-click to add a link"); double-clicking opens the link picker,
  // and setting a URL unfurls a preview.
  const addLinkCard = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'link-card' });
  };

  // An embed (docs/specs/009-elements/youtube-video.md, docs/specs/009-elements/embed-providers.md), drawn to size and empty. Same shape as the
  // link card above, and deliberately so: both keep their URL in `link`, and
  // double-clicking either opens the one link picker. The provider rides the
  // intent so the tile the user pressed is the service they get; the 16:9
  // lock means the drag picks the scale, not the ratio (see draw-commit).
  const addVideo = (provider?: EmbedProvider) => {
    if (editsBlocked) return;
    beginDraw({ type: 'video', ...(provider ? { provider } : {}) });
  };

  // Components (docs/specs/008-canvas/canvas-and-palette.md) arm the combined tap-or-drag draw gesture, exactly
  // like shapes: a tap drops the composite at its natural size on the tap
  // point, a drag scales the whole group to the dragged box. The build (theme
  // colours, group assembly, scaling) + telemetry happen on commit in
  // useShapeDrawing.commitDraw, so these are thin "arm the intent" wrappers.
  // Avatar rides the same gesture though it lives in the Tools tab (it's a
  // single circular image, not a composite — see addAvatar / the palette).
  const addBanner = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'component', kind: 'banner' });
  };
  const addHero = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'component', kind: 'hero' });
  };
  const addHeader = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'component', kind: 'header' });
  };
  const addCallout = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'component', kind: 'callout' });
  };
  const addStatRow = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'component', kind: 'stat' });
  };
  const addProcess = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'component', kind: 'process' });
  };
  const addAvatar = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'component', kind: 'avatar' });
  };
  // A flowchart's first step (docs/specs/009-elements/flowchart.md).
  const addFlowchart = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'component', kind: 'flowchart' });
  };

  const addText = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'text' });
  };
  const addSticky = () => {
    if (editsBlocked) return;
    // On a Dashboard a sticky is a note in a slot.
    if (placeOnDashboard(dashboardItemOf('sticky'))) return;
    beginDraw({ type: 'sticky' });
  };

  // Click-to-connect (docs/specs/008-canvas/canvas-and-palette.md) — arm from the selection, complete on the next
  // element click, or abandon. See useArrowConnect.
  const { connectSourceId, cancelConnect, addArrow, connectArrowTo } = useArrowConnect({
    editsBlocked,
    activeId,
    activeTab,
    readSelection,
    setSelectedId,
    beginDraw,
    commitTabs,
    styleNewElement,
  });

  // Drag-from-palette drop (docs/specs/008-canvas/canvas-and-palette.md): place the dragged kind centred on the
  // drop point. Shapes / devices use createShape; an icon carries `iconId`,
  // a sticker `stickerId` (docs/specs/010-palette/stickers.md).
  const dropPaletteItem = (
    kind: ShapeKind | 'sticky',
    canvasX: number,
    canvasY: number,
    art?: { iconId?: string; stickerId?: string; choice?: string },
  ) => {
    if (editsBlocked) return;
    if (kind === 'plan-card') {
      onPlanCardPlace?.(art?.choice, canvasX, canvasY);
      return;
    }
    const iconId = art?.iconId;
    const stickerId = art?.stickerId;
    if (kind === 'sticky') {
      // A dragged sticky lands exactly like a tapped one — the drop point is
      // the only difference — so it goes through the same builder. placeBoxed re-centres and leaves sticky
      // colours alone.
      addBoxedAt(
        canvasX,
        canvasY,
        (x, y) => buildDrawnBoxed({ type: 'sticky' }, x, y, x, y, null, activeTab),
        { edit: true },
      );
      track('Element', 'Added', 'Sticky');
      return;
    }
    if (stickerId) {
      // A dragged sticker lands at its flavour's natural size, square to the
      // canvas, exactly like a tapped one — the drop point is the only
      // difference.
      addBoxedAt(
        canvasX,
        canvasY,
        (x, y) => {
          const el = createShape('sticker', x, y);
          const size = stickerDropSize(getSticker(stickerId), el);
          return { ...el, ...size, stickerId };
        },
        { style: styleNewElement },
      );
      track('Element', 'Added', 'Sticker');
      return;
    }
    addBoxedAt(
      canvasX,
      canvasY,
      (x, y) =>
        iconId
          ? {
              ...createShape('icon', x, y),
              iconId,
              // The four animated glyphs arrive already moving (docs/specs/008-canvas/canvas-and-palette.md),
              // same as the draw path.
              ...(defaultIconAnimation(iconId)
                ? { iconAnimation: defaultIconAnimation(iconId) }
                : {}),
              // Tech icons land self-describing (S3, EKS, ...) on drag too,
              // matching the click-to-add addTechIcon path — and unlocked:
              // the mark renders at a fixed size (docs/specs/010-palette/technology-icons.md), so the aspect
              // lock would only fight resizing the caption room.
              ...(isTechIconId(iconId)
                ? { label: getTechIcon(iconId)?.label ?? '', aspectLocked: false }
                : {}),
            }
          : {
              // A creation-time variant (the Callout card, a Funnel) applies to its own kind only.
              ...applyShapeVariant(createShape(kind, x, y), art?.choice),
              // The dragged tile's creation-time choice (docs/specs/012-collaboration/session-button.md): the
              // session tool the tile places.
              ...(art?.choice && kind === 'session-button'
                ? {
                    session: defaultSessionConfig(art.choice as SessionTool),
                    // Same sizing the tap path applies (draw-commit): a timer is a wide pill.
                    ...(art.choice === 'timer' ? { width: 224, height: 64 } : {}),
                  }
                : {}),
              // A board wide enough for its columns (docs/specs/026-plan/plan-board.md).
              ...(kind === 'plan-board' ? planBoardPlacement(art?.choice, activeTab.name) : {}),
              ...(kind === 'plan-view' ? planViewPlacement(art?.choice) : {}),
              // A Sheet names a new sheet (docs/specs/029-sheets/sheet.md "Placing a sheet").
              ...(kind === 'plan-sheet'
                ? {
                    // Named after its tab (docs/specs/029-sheets/sheet.md "Placing a sheet").
                    planSheet: placeNewSheet({
                      title: sheetTitleForTab(activeTab.name, art?.choice),
                      ...(isPlacedSheetStart(art?.choice) ? { start: art.choice } : {}),
                      ...(art?.choice === BLANK_SHEET_CHOICE ? { blank: true as const } : {}),
                    }),
                  }
                : {}),
            },
      // Shapes and icons open for typing too; takesTypedLabel filters out the
      // kinds whose face isn't text (stickers, session buttons, ...). A preset's own colour (the Warning badge's
      // rose) is put back after the theme and the remembered style.
      {
        edit: true,
        style: (el) => {
          const styled = styleNewElement(el);
          return (
            styled.type === 'shape' ? withVariantColours(styled, art?.choice) : styled
          ) as typeof el;
        },
      },
    );
    // A tech-icon id maps to its own telemetry type (see addTechIcon);
    // line-art icons + shapes use the kind.
    track(
      'Element',
      'Added',
      iconId && isTechIconId(iconId) ? 'TechIcon' : titleCaseType(iconId ? 'icon' : kind),
    );
  };

  const handleCanvasDoubleClick = (x: number, y: number) => {
    // Same creation gate as every other add path (addShape, addIcon, ...):
    // a locked/loading tab, a view-only session, or a hidden/locked active
    // layer silently no-ops (the layers slice toasts WHY once). Without
    // this, double-click was the one path that bypassed the gate — on a
    // hidden active layer it stamped the text onto an unrendered layer,
    // which read as "double-click does nothing".
    if (editsBlocked) return;
    const TEXT_W = 160;
    const TEXT_H = 48;
    const el = createText(x - TEXT_W / 2, y - TEXT_H / 2);
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId ? { ...t, elements: [...t.elements, el], templateChosen: true } : t,
      ),
    );
    setSelectedId(el.id);
    setEditingId(el.id);
    // Double-clicking empty canvas is a first-class "make a Text element"
    // path, same as the quick-connect "add text" action — count it so it
    // isn't invisible to the Element/Added dashboard (docs/specs/017-telemetry/telemetry.md).
    track('Element', 'Added', 'Text');
  };

  return {
    addShape,
    addIcon,
    addSticker,
    addTechIcon,
    addTable,
    addAnnotation,
    addLinkCard,
    addVideo,
    addBanner,
    addHero,
    addHeader,
    addCallout,
    addStatRow,
    addProcess,
    addFlowchart,
    addAvatar,
    dropPaletteItem,
    addText,
    addSticky,
    addArrow,
    handleCanvasDoubleClick,
    connectSourceId,
    connectArrowTo,
    cancelConnect,
  };
}
