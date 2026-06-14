'use client';

// Right-click context menu for the editor, lifted out of
// editor-page.tsx. Renders one of two menus depending on what was
// clicked: an element-scoped menu (link / layer order / note /
// comment) or a canvas-scoped menu (change theme / canvas,
// auto-align, add shape / sticky). Duplicate lives in the selection
// toolbar (SelectionPopover), not here.
//
// Purely presentational: every action is a callback prop, and each
// item closes the menu after firing (the close-then-act pattern the
// inline version used). The page owns the open/closed state + the
// handlers; this component only decides which items to show.

import { useState, type ReactNode } from 'react';
import {
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  isBoxed,
  supportsBorder,
  supportsBorderRadius,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type Element,
  type ShapeKind,
} from '@livediagram/diagram';
import { ContextMenu, ContextMenuDivider } from '@/components/ContextMenu';
import { SizeButton, ToggleSwitch } from '@/components/palette-controls';
import { BorderRadiusIcon, BorderStrokeIcon, BorderStyleIcon } from '@/components/palette-icons';
import {
  AnnotationMenuIcon,
  AutoAlignIcon,
  CanvasMenuIcon,
  CommentMenuIcon,
  LayerDownIcon,
  LayerUpIcon,
  LinkMenuIcon,
  NoteMenuIcon,
  PaletteMenuIcon,
  PencilMenuIcon,
  SquareMenuIcon,
  StickyMenuIcon,
} from '@/components/context-menu-icons';
import { MenuItem } from '@/components/PortalMenu';

// Cursor position + which menu to show. `element` carries the clicked
// element id; `canvas` is the empty-canvas right-click. Exported so
// the page can type its own context-menu state against it.
export type EditorContextMenuState =
  | { mode: 'element'; elementId: string; x: number; y: number }
  | { mode: 'canvas'; x: number; y: number };

type EditorContextMenuProps = {
  menu: EditorContextMenuState;
  // The active tab's elements — used to resolve the clicked element
  // (for the element menu) and read its link / note state.
  elements: Element[];
  onClose: () => void;
  // Open the link picker for the element, optionally pre-selecting a mode
  // (webpage / tab / diagram) so the modal lands on the right tab.
  onLinkElement: (elementId: string, mode?: 'url' | 'tab' | 'diagram') => void;
  // Remove an inline icon from the element. Only surfaced when the
  // clicked element actually carries one (a non-'icon' shape with iconId).
  onRemoveIcon: (elementId: string) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  // Toggle aspect-ratio lock + set opacity on the clicked element (boxed
  // only). Read the current values off the target below.
  onToggleAspectLock: () => void;
  onSetOpacity: (opacity: number) => void;
  onSetTextColor: (color: string) => void;
  onSetFillColor: (color: string) => void;
  onSetStrokeColor: (color: string) => void;
  onSetBorderStroke: (value: BorderStroke) => void;
  onSetBorderStyle: (value: BorderStyle) => void;
  onSetBorderRadius: (value: BorderRadius) => void;
  onResetColors: () => void;
  // Re-place a shape's inline icon (reuses the drop handler: same iconId,
  // new side).
  onSetIconPosition: (
    elementId: string,
    iconId: string,
    position: 'left' | 'right' | 'above' | 'below',
  ) => void;
  onOpenNote: (elementId: string) => void;
  onOpenComments: (elementId: string) => void;
  onChangeTheme: () => void;
  onChangeCanvas: () => void;
  onAutoAlign: () => void;
  onAddShape: (kind: ShapeKind) => void;
  onAddSticky: () => void;
  onDrawPencil: () => void;
  onAddAnnotation: () => void;
};

export function EditorContextMenu(props: EditorContextMenuProps) {
  const { menu, elements, onClose } = props;
  const position = { x: menu.x, y: menu.y };
  // Which collapsible section is open in the element menu — at most one at a
  // time (null = all collapsed). An accordion the user can only open one of.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const sectionProps = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((s) => (s === id ? null : id)),
  });

  if (menu.mode === 'element') {
    const target = elements.find((el) => el.id === menu.elementId);
    if (!target) return null;
    const boxed = isBoxed(target);
    const isIcon = target.type === 'shape' && target.shape === 'icon';
    // Border controls apply to shapes / freehand / tables (not icons),
    // mirroring the panel's Border accordion gating + effective values.
    const borderable = (supportsBorder(target) || target.type === 'table') && !isIcon;
    const borderStrokeVal: BorderStroke =
      (target as { strokeWidth?: BorderStroke }).strokeWidth ??
      (target.type === 'table' ? 'thin' : 'medium');
    const borderStyleVal: BorderStyle =
      (target as { strokeStyle?: BorderStyle }).strokeStyle ?? 'solid';
    const borderRadiusVal: BorderRadius =
      (target as { borderRadius?: BorderRadius }).borderRadius ?? 'sm';
    // A regular shape carrying an inline icon (drag-an-icon-onto-it
    // feature, spec/09) gets a "Remove icon" entry; the dedicated 'icon'
    // shape is its own glyph and excluded.
    const hasInlineIcon =
      target.type === 'shape' && target.shape !== 'icon' && target.iconId !== undefined;
    return (
      <ContextMenu position={position} onClose={onClose} flush>
        {/* Links — webpage / tab / diagram. Arrows can't be linked. */}
        {boxed ? (
          <MenuAccordionSection title="Links" icon={<LinkMenuIcon />} {...sectionProps('links')}>
            <MenuItem
              icon={<LinkMenuIcon />}
              label="Link to webpage"
              onClick={() => {
                props.onLinkElement(target.id, 'url');
                onClose();
              }}
            />
            <MenuItem
              icon={<LinkMenuIcon />}
              label="Link to tab"
              onClick={() => {
                props.onLinkElement(target.id, 'tab');
                onClose();
              }}
            />
            <MenuItem
              icon={<LinkMenuIcon />}
              label="Link to diagram"
              onClick={() => {
                props.onLinkElement(target.id, 'diagram');
                onClose();
              }}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Icon — re-place or remove a shape's inline icon. */}
        {hasInlineIcon ? (
          <MenuAccordionSection title="Icon" icon={<IconCategoryGlyph />} {...sectionProps('icon')}>
            <div className="grid grid-cols-2 gap-1 px-2 py-1.5">
              {ICON_POSITIONS.map((p) => {
                const current = (target as { iconPosition?: string }).iconPosition ?? 'left';
                const iconId = (target as { iconId?: string }).iconId ?? '';
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={current === p.key}
                    onClick={() => props.onSetIconPosition(target.id, iconId, p.key)}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${
                      current === p.key
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <ContextMenuDivider />
            <MenuItem
              icon={<RemoveIconGlyph />}
              label="Remove icon"
              onClick={() => {
                props.onRemoveIcon(target.id);
                onClose();
              }}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Layer — a collapsible section grouping front/back + opacity +
            (for boxed elements) the aspect-ratio lock. */}
        <MenuAccordionSection title="Layer" icon={<LayersGlyph />} {...sectionProps('layer')}>
          <div className="flex gap-1 px-2 py-0.5">
            <MenuRowButton
              icon={<LayerUpIcon />}
              label="Front"
              onClick={() => {
                props.onBringToFront();
                onClose();
              }}
            />
            <MenuRowButton
              icon={<LayerDownIcon />}
              label="Back"
              onClick={() => {
                props.onSendToBack();
                onClose();
              }}
            />
          </div>
          <ContextMenuDivider />
          {/* Opacity slider — a non-closing row (dragging stays inside the
              menu, so the outside-click guard leaves it open). */}
          <OpacityRow
            value={(target as { opacity?: number }).opacity ?? 1}
            onChange={props.onSetOpacity}
          />
          {boxed ? (
            <>
              <ContextMenuDivider />
              {/* Lock aspect ratio — iOS-style switch, matching the panel. */}
              <div className="flex items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  <span className="text-slate-400 dark:text-slate-500">
                    <AspectLockMenuIcon />
                  </span>
                  Lock aspect ratio
                </span>
                <ToggleSwitch
                  checked={!!(target as { aspectLocked?: boolean }).aspectLocked}
                  onChange={props.onToggleAspectLock}
                  label="Lock aspect ratio"
                />
              </div>
            </>
          ) : null}
        </MenuAccordionSection>
        {/* Colours — text / background / border swatches (boxed elements). */}
        {boxed ? (
          <>
            <MenuAccordionSection
              title="Colours"
              icon={<PaletteMenuIcon />}
              {...sectionProps('colours')}
            >
              <ColourRow
                label="Text"
                value={
                  (target as { textColor?: string }).textColor ??
                  defaultTextColor(target as BoxedElement)
                }
                onChange={props.onSetTextColor}
              />
              {defaultFillColor(target as BoxedElement) !== 'transparent' ? (
                <ColourRow
                  label="Background"
                  value={
                    (target as { fillColor?: string }).fillColor ??
                    defaultFillColor(target as BoxedElement)
                  }
                  onChange={props.onSetFillColor}
                />
              ) : null}
              {defaultStrokeColor(target as BoxedElement) !== 'transparent' ? (
                <ColourRow
                  label="Border"
                  value={
                    (target as { strokeColor?: string }).strokeColor ??
                    defaultStrokeColor(target as BoxedElement)
                  }
                  onChange={props.onSetStrokeColor}
                />
              ) : null}
              <div className="px-2 pb-1 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    props.onResetColors();
                    onClose();
                  }}
                  className="inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
                >
                  Reset to theme
                </button>
              </div>
            </MenuAccordionSection>
          </>
        ) : null}
        {/* Border — strength / pattern / radius, same options as the panel. */}
        {borderable ? (
          <>
            <MenuAccordionSection title="Border" icon={<BorderGlyph />} {...sectionProps('border')}>
              <div className="px-2 py-1">
                <BorderGrid label="Strength" cols={5}>
                  {BORDER_STROKES.map((v) => (
                    <BorderButton
                      key={v}
                      active={borderStrokeVal === v}
                      onClick={() => props.onSetBorderStroke(v)}
                    >
                      <BorderStrokeIcon value={v} />
                    </BorderButton>
                  ))}
                </BorderGrid>
                <BorderGrid label="Pattern" cols={3}>
                  {BORDER_STYLES.map((v) => (
                    <BorderButton
                      key={v}
                      active={borderStyleVal === v}
                      onClick={() => props.onSetBorderStyle(v)}
                    >
                      <BorderStyleIcon value={v} />
                    </BorderButton>
                  ))}
                </BorderGrid>
                {supportsBorderRadius(target) ? (
                  <BorderGrid label="Radius" cols={4}>
                    {BORDER_RADII.map((v) => (
                      <BorderButton
                        key={v}
                        active={borderRadiusVal === v}
                        onClick={() => props.onSetBorderRadius(v)}
                      >
                        <BorderRadiusIcon value={v} />
                      </BorderButton>
                    ))}
                  </BorderGrid>
                ) : null}
              </div>
            </MenuAccordionSection>
          </>
        ) : null}
        {/* Collaborate — notes + comments grouped under one collapsible header. */}
        <MenuAccordionSection
          title="Collaborate"
          icon={<CommentMenuIcon />}
          {...sectionProps('collaborate')}
        >
          {boxed ? (
            <MenuItem
              icon={<NoteMenuIcon />}
              label={target.note ? 'Edit note' : 'Add note'}
              onClick={() => {
                props.onOpenNote(target.id);
                onClose();
              }}
            />
          ) : null}
          <MenuItem
            icon={<CommentMenuIcon />}
            label="View comments"
            onClick={() => {
              props.onOpenComments(target.id);
              onClose();
            }}
          />
        </MenuAccordionSection>
      </ContextMenu>
    );
  }

  return (
    <ContextMenu position={position} onClose={onClose}>
      <MenuItem
        icon={<PaletteMenuIcon />}
        label="Change Theme"
        onClick={() => {
          props.onChangeTheme();
          onClose();
        }}
      />
      <MenuItem
        icon={<CanvasMenuIcon />}
        label="Change Canvas"
        onClick={() => {
          props.onChangeCanvas();
          onClose();
        }}
      />
      <ContextMenuDivider />
      <MenuItem
        icon={<AutoAlignIcon />}
        label="Auto-align tab"
        onClick={() => {
          props.onAutoAlign();
          onClose();
        }}
      />
      <ContextMenuDivider />
      <MenuItem
        icon={<SquareMenuIcon />}
        label="Add square"
        onClick={() => {
          props.onAddShape('square');
          onClose();
        }}
      />
      <MenuItem
        icon={<StickyMenuIcon />}
        label="Add sticky"
        onClick={() => {
          props.onAddSticky();
          onClose();
        }}
      />
      <ContextMenuDivider />
      <MenuItem
        icon={<PencilMenuIcon />}
        label="Draw pencil"
        onClick={() => {
          props.onDrawPencil();
          onClose();
        }}
      />
      <MenuItem
        icon={<AnnotationMenuIcon />}
        label="Add annotation"
        onClick={() => {
          props.onAddAnnotation();
          onClose();
        }}
      />
    </ContextMenu>
  );
}

// A collapsible section inside the context menu: an uppercase header (with
// a chevron) that toggles its content. Controlled by the parent so only one
// section is open at a time. Toggling doesn't close the menu (the header
// isn't a MenuItem; the click stays inside the menu, so the outside-click
// guard leaves it open). The content height animates via the grid-rows
// 0fr<->1fr trick (no fixed height needed).
function MenuAccordionSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    // border-t on the wrapper (not a margin'd divider) so headers butt up to
    // the separator with no gap; `first:border-t-0` drops the stray line at
    // the very top of the menu.
    <div className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-300"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        >
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-200 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        {/* Faint tint on the expanded content so a category's body reads as
            distinct from the menu / headers around it. The clipped wrapper
            stays padding-free (padding wouldn't collapse with the 0fr grid
            trick); top/bottom breathing room lives on the inner div, which is
            fully clipped when collapsed. */}
        <div className="overflow-hidden bg-slate-50/70 dark:bg-slate-800/30">
          <div className="py-1.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

// 6-hex or fall back to white for the native colour input (it can't take
// 'transparent' or named colours).
function hexish(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff';
}

// One labelled colour row inside the Colours section: the label on the left,
// the colour shown as a square on the RIGHT, with the native picker behind it.
function ColourRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label={`${label} colour`}
    >
      <span>{label}</span>
      <span
        className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600"
        style={{ backgroundColor: hexish(value) }}
        aria-hidden
      />
      <input
        type="color"
        value={hexish(value)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} colour`}
        className="absolute h-0 w-0 opacity-0"
      />
    </label>
  );
}

const BORDER_STROKES: readonly BorderStroke[] = ['none', 'thin', 'medium', 'thick', 'extra-thick'];
const BORDER_STYLES: readonly BorderStyle[] = [
  'solid',
  'dashed',
  'dotted',
  'dash-dot',
  'long-dash',
  'dash-dot-dot',
];
const BORDER_RADII: readonly BorderRadius[] = ['none', 'sm', 'md', 'lg'];

const ICON_POSITIONS: { key: 'left' | 'above' | 'right' | 'below'; label: string }[] = [
  { key: 'left', label: 'Left' },
  { key: 'above', label: 'Top' },
  { key: 'right', label: 'Right' },
  { key: 'below', label: 'Bottom' },
];

// One labelled button grid in the Border section. Literal column classes so
// Tailwind keeps them.
function BorderGrid({
  label,
  cols,
  children,
}: {
  label: string;
  cols: 3 | 4 | 5;
  children: ReactNode;
}) {
  const colClass = cols === 5 ? 'grid-cols-5' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3';
  return (
    <div className="mb-1.5 last:mb-0">
      <p className="px-1 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className={`grid gap-1 ${colClass}`}>{children}</div>
    </div>
  );
}

// Border preset button — SizeButton with the menu's active tone.
function BorderButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <SizeButton active={active} onClick={onClick}>
      {children}
    </SizeButton>
  );
}

// Rounded-square outline — the "Border" section glyph.
function BorderGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
    </svg>
  );
}

// A compact menu button used where two actions share one row (Front /
// Back). Mirrors MenuItem's tone but centres its icon + label and flexes
// to fill half the row.
function MenuRowButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className="text-slate-400 dark:text-slate-500">{icon}</span>
      {label}
    </button>
  );
}

// Opacity slider row inside the context menu. Doesn't close the menu on
// interaction (it isn't a MenuItem): dragging fires pointer events inside
// the menu, so the ContextMenu's outside-click guard keeps it open.
function OpacityRow({ value, onChange }: { value: number; onChange: (opacity: number) => void }) {
  const pct = Math.round(value * 100);
  return (
    <div className="px-3 py-1.5">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Opacity</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label="Opacity"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
        />
        <span className="w-10 text-right text-xs font-medium text-slate-700 dark:text-slate-200">
          {pct}%
        </span>
      </div>
    </div>
  );
}

// Stacked diamonds — the "Layer" section glyph. 12x12 stroke style of the
// shared context-menu icons.
function LayersGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2 14 5.5 8 9 2 5.5z" />
      <path d="m3.5 8 4.5 2.6L12.5 8M3.5 11l4.5 2.6L12.5 11" />
    </svg>
  );
}

// Rectangle with corner ticks — "lock aspect ratio". 12x12 stroke style of
// the shared context-menu icons.
function AspectLockMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M5 8.5v2.5h2.5M11 7.5V5H8.5" />
    </svg>
  );
}

// A star — the "Icon" category glyph (the un-slashed sibling of
// RemoveIconGlyph).
function IconCategoryGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 11.2 4.8 12.9l.6-3.6L2.8 6.8l3.6-.5z" />
    </svg>
  );
}

// A star glyph with a slash — "remove the inline icon". Matches the
// 12x12 stroke style of the shared context-menu icons.
function RemoveIconGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 11.2 4.8 12.9l.6-3.6L2.8 6.8l3.6-.5z" />
      <path d="M2.5 13.5l11-11" />
    </svg>
  );
}
