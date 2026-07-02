import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  acceptsInlineIcon,
  bestAnchorTowards,
  createAnnotation,
  createLinkCard,
  createShape,
  createTable,
  createText,
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type ShapeKind,
  type Tab,
} from '@livediagram/diagram';
import { getTheme } from '@/lib/themes';
import { getTechIcon, isTechIconId } from '@/lib/tech-icons';
import { track, titleCaseType } from '@/lib/telemetry';
import type { PendingDraw } from '@/lib/draw-mode';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Palette element-creation handlers, lifted out of editor-page.tsx. The
// draw-capable elements (shape / text / sticky / arrow) arm the combined
// add gesture (beginDraw, from useShapeDrawing) — the canvas then drops
// them at default size on a tap or sizes them on a drag. Icons + tables
// have no draw-to-size, so they drop straight at the viewport centre via
// addBoxed (from useElementHelpers).
export function useElementCreation(opts: {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  // The single-selected element id, so "add an icon" can drop it INSIDE
  // a selected shape instead of creating a standalone icon element.
  selectedId: string | null;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  addBoxed: <T extends BoxedElement>(make: (x: number, y: number) => T) => void;
  addBoxedAt: <T extends BoxedElement>(
    canvasX: number,
    canvasY: number,
    make: (x: number, y: number) => T,
  ) => void;
  beginDraw: (intent: PendingDraw) => void;
}) {
  const {
    editsBlocked,
    activeId,
    activeTab,
    selectedId,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxed,
    addBoxedAt,
    beginDraw,
  } = opts;

  // Telemetry for these arming handlers fires on commit (see
  // useShapeDrawing.commitDraw), once the tap / drag actually lands the
  // element — not here, where the gesture is only queued.
  const addShape = (kind: ShapeKind) => {
    if (editsBlocked) return;
    beginDraw({ type: 'shape', kind });
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
    // standalone element you place inside it, see spec/38).
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
                  e.id === sel.id ? { ...e, iconId, iconPosition: sel.iconPosition ?? 'left' } : e,
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

  // Technology (brand) icon (spec/41). Reuses the 'icon' shape kind but is
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

  // A 3x3 table dropped at the viewport centre (no draw-to-size:
  // the grid sizes itself; the user resizes the whole box after).
  const addTable = () => {
    if (editsBlocked) return;
    addBoxed((x, y) => createTable(x, y));
    track('Element', 'Added', titleCaseType('table'));
  };

  // A note marker (spec/38) dropped at the viewport centre (no
  // draw-to-size: it's a fixed-size marker, not a box you drag out). The
  // user clicks it afterwards to add the note text.
  const addAnnotation = () => {
    if (editsBlocked) return;
    addBoxed((x, y) => createAnnotation(x, y));
    track('Element', 'Added', titleCaseType('annotation'));
  };

  // A link-card / bookmark (spec/40) dropped at the viewport centre. The card
  // starts empty ("double-click to add a link"); double-clicking opens the
  // link picker, and setting a URL unfurls a preview.
  const addLinkCard = () => {
    if (editsBlocked) return;
    addBoxed((x, y) => createLinkCard(x, y));
    track('Element', 'Added', 'LinkCard');
  };

  // Components (spec/09) arm the combined tap-or-drag draw gesture, exactly
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

  const addText = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'text' });
  };
  const addSticky = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'sticky' });
  };

  // Click-to-connect (spec/09): when the arrow tool is picked WITH a
  // shape selected, the next element click connects the two with a
  // pinned arrow. `connectSourceId` holds that armed source; null when
  // not connecting. The canvas / Escape clear it (see EditorView).
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const cancelConnect = () => setConnectSourceId(null);

  // Arm connect-from-selection when a shape is selected; otherwise fall
  // back to the draw-to-place connector (free endpoints, dragged onto
  // shapes later). The palette + the A shortcut both route here.
  const addArrow = () => {
    if (editsBlocked) return;
    const sel = selectedId ? activeTab.elements.find((e) => e.id === selectedId) : null;
    if (sel && isBoxed(sel)) {
      setConnectSourceId(sel.id);
      return;
    }
    beginDraw({ type: 'arrow' });
  };

  // Complete the connect gesture: draw a pinned arrow from the armed
  // source to `toId`, picking the anchor on each shape that faces the
  // other (bestAnchorTowards) and inheriting the source's stroke so it
  // matches the theme. No-ops if either end isn't a shape or it's the
  // same element. Clears the armed state either way.
  const connectArrowTo = (toId: string) => {
    const fromId = connectSourceId;
    setConnectSourceId(null);
    if (editsBlocked || !fromId || fromId === toId) return;
    const from = activeTab.elements.find((e) => e.id === fromId);
    const to = activeTab.elements.find((e) => e.id === toId);
    if (!from || !to || !isBoxed(from) || !isBoxed(to)) return;
    const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    // Pick the geometrically-best face on each endpoint, facing the other
    // element. We deliberately DON'T avoid faces other arrows already use:
    // sharing a start/end point is allowed, and steering off the natural
    // face just to dodge an occupied one produced visibly worse connectors.
    const theme = getTheme(activeTab.theme);
    const stroke = from.strokeColor ?? theme.elementStroke ?? undefined;
    const arrow: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      from: {
        kind: 'pinned',
        elementId: fromId,
        anchor: bestAnchorTowards(from, toCenter),
      },
      to: {
        kind: 'pinned',
        elementId: toId,
        anchor: bestAnchorTowards(to, fromCenter),
      },
      ...(stroke ? { strokeColor: stroke } : {}),
    };
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId ? { ...t, elements: [...t.elements, arrow], templateChosen: true } : t,
      ),
    );
    setSelectedId(arrow.id);
    track('Element', 'Added', 'Arrow');
  };

  // Drag-from-palette drop (spec/09): place the dragged kind centred on the
  // drop point. Shapes / devices use createShape; an icon carries iconId.
  const dropPaletteItem = (kind: ShapeKind, canvasX: number, canvasY: number, iconId?: string) => {
    if (editsBlocked) return;
    addBoxedAt(canvasX, canvasY, (x, y) =>
      iconId
        ? {
            ...createShape('icon', x, y),
            iconId,
            // Tech icons land self-describing (S3, EKS, ...) on drag too,
            // matching the click-to-add addTechIcon path.
            ...(isTechIconId(iconId) ? { label: getTechIcon(iconId)?.label ?? '' } : {}),
          }
        : createShape(kind, x, y),
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
    // isn't invisible to the Element/Added dashboard (spec/22).
    track('Element', 'Added', 'Text');
  };

  return {
    addShape,
    addIcon,
    addTechIcon,
    addTable,
    addAnnotation,
    addLinkCard,
    addBanner,
    addHero,
    addHeader,
    addCallout,
    addStatRow,
    addProcess,
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
