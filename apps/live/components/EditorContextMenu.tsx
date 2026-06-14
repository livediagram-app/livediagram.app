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
  type TextSize,
} from '@livediagram/diagram';
import { ContextMenu, ContextMenuDivider } from '@/components/ContextMenu';
import { SizeButton, ToggleSwitch } from '@/components/palette-controls';
import {
  BoldIcon,
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
  DotsIcon,
  ItalicIcon,
  ScaleIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette-icons';
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
import { MenuAccordionSection, MenuItem } from '@/components/PortalMenu';

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
  // Whole-element text formatting — surfaced for arrows that carry a label
  // (boxed elements format via the inline rich-text toolbar instead).
  onToggleTextBold: () => void;
  onToggleTextItalic: () => void;
  onToggleTextUnderline: () => void;
  onToggleTextStrikethrough: () => void;
  onSetTextSize: (size: TextSize) => void;
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
  // Session tools (spec/39) for the canvas menu's Session category.
  timerActive: boolean;
  voteActive: boolean;
  onStartTimer: (mode: 'countdown' | 'stopwatch', durationMs?: number) => void;
  onClearTimer: () => void;
  onStartVote: (votesPerPerson: number) => void;
  onEndVote: () => void;
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
  // Which colour row's inline palette is open (text / background / border) —
  // at most one, toggled by re-clicking the row so it never sticks open.
  const [openColor, setOpenColor] = useState<string | null>(null);
  const colorProps = (id: string) => ({
    open: openColor === id,
    onToggle: () => setOpenColor((c) => (c === id ? null : id)),
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
        {/* Icon — re-place or remove a shape's inline icon. */}
        {hasInlineIcon ? (
          <MenuAccordionSection title="Icon" icon={<IconCategoryGlyph />} {...sectionProps('icon')}>
            <p className="px-3 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Icon position
            </p>
            <IconPositionGrid
              current={(target as { iconPosition?: string }).iconPosition ?? 'left'}
              onPick={(pos) =>
                props.onSetIconPosition(
                  target.id,
                  (target as { iconId?: string }).iconId ?? '',
                  pos,
                )
              }
            />
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
        {/* Text — whole-element label formatting for a labelled arrow (boxed
            elements format via the inline rich-text toolbar instead). */}
        {target.type === 'arrow' && target.label ? (
          <MenuAccordionSection title="Text" icon={<TextGlyph />} {...sectionProps('text')}>
            <div className="flex gap-1 px-2 py-1.5">
              <TextToggle active={!!target.textBold} label="Bold" onClick={props.onToggleTextBold}>
                <BoldIcon />
              </TextToggle>
              <TextToggle
                active={!!target.textItalic}
                label="Italic"
                onClick={props.onToggleTextItalic}
              >
                <ItalicIcon />
              </TextToggle>
              <TextToggle
                active={!!target.textUnderline}
                label="Underline"
                onClick={props.onToggleTextUnderline}
              >
                <UnderlineIcon />
              </TextToggle>
              <TextToggle
                active={!!target.textStrikethrough}
                label="Strikethrough"
                onClick={props.onToggleTextStrikethrough}
              >
                <StrikethroughIcon />
              </TextToggle>
            </div>
            <p className="px-3 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Size
            </p>
            <div className="grid grid-cols-4 gap-1 px-2 pb-1.5">
              {(
                [
                  ['scale', <ScaleIcon key="s" />],
                  ['sm', <DotsIcon key="1" count={1} />],
                  ['md', <DotsIcon key="2" count={2} />],
                  ['lg', <DotsIcon key="3" count={3} />],
                ] as const
              ).map(([size, glyph]) => (
                <SizeButton
                  key={size}
                  active={(target.textSize ?? 'sm') === size}
                  onClick={() => props.onSetTextSize(size)}
                >
                  {glyph}
                </SizeButton>
              ))}
            </div>
            <ContextMenuDivider />
            <ColourRow
              label="Colour"
              value={target.textColor ?? '#0f172a'}
              onChange={props.onSetTextColor}
              {...colorProps('text')}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Layer — a collapsible section grouping front/back + opacity +
            (for boxed elements) the aspect-ratio lock. */}
        <MenuAccordionSection title="Layer" icon={<LayersGlyph />} {...sectionProps('layer')}>
          <div className="flex gap-1 px-2 py-0.5">
            {/* Layer order tweaks keep the menu open so you can nudge
                front/back a few times in a row. */}
            <MenuRowButton icon={<LayerUpIcon />} label="Front" onClick={props.onBringToFront} />
            <MenuRowButton icon={<LayerDownIcon />} label="Back" onClick={props.onSendToBack} />
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
                {...colorProps('text')}
              />
              {defaultFillColor(target as BoxedElement) !== 'transparent' ? (
                <ColourRow
                  label="Background"
                  value={
                    (target as { fillColor?: string }).fillColor ??
                    defaultFillColor(target as BoxedElement)
                  }
                  onChange={props.onSetFillColor}
                  {...colorProps('background')}
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
                  {...colorProps('border')}
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
        {/* Collaborate — link / note / comments. Boxed-only: arrows can't be
            linked, noted, or commented on. */}
        {boxed ? (
          <MenuAccordionSection
            title="Collaborate"
            icon={<CommentMenuIcon />}
            {...sectionProps('collaborate')}
          >
            <MenuItem
              icon={<LinkMenuIcon />}
              label={target.link ? 'Edit link' : 'Link to Source'}
              onClick={() => {
                props.onLinkElement(target.id);
                onClose();
              }}
            />
            <MenuItem
              icon={<NoteMenuIcon />}
              label={target.note ? 'Edit note' : 'Add note'}
              onClick={() => {
                props.onOpenNote(target.id);
                onClose();
              }}
            />
            <MenuItem
              icon={<CommentMenuIcon />}
              label="View comments"
              onClick={() => {
                props.onOpenComments(target.id);
                onClose();
              }}
            />
          </MenuAccordionSection>
        ) : null}
      </ContextMenu>
    );
  }

  return (
    <ContextMenu position={position} onClose={onClose} flush>
      {/* Canvas — theme / background / tidy. */}
      <MenuAccordionSection title="Canvas" icon={<CanvasMenuIcon />} {...sectionProps('canvas')}>
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
        <MenuItem
          icon={<AutoAlignIcon />}
          label="Auto-align tab"
          onClick={() => {
            props.onAutoAlign();
            onClose();
          }}
        />
      </MenuAccordionSection>
      {/* Add — drop a new element on the canvas. */}
      <MenuAccordionSection title="Add" icon={<SquareMenuIcon />} {...sectionProps('add')}>
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
      </MenuAccordionSection>
      {/* Session — timer + voting facilitator tools (spec/39). */}
      <MenuAccordionSection title="Session" icon={<SessionGlyph />} {...sectionProps('session')}>
        {props.timerActive ? (
          <MenuItem
            icon={<TimerGlyph />}
            label="Stop timer"
            onClick={() => {
              props.onClearTimer();
              onClose();
            }}
          />
        ) : (
          <>
            <MenuItem
              icon={<TimerGlyph />}
              label="Start countdown (5 min)"
              onClick={() => {
                props.onStartTimer('countdown', 5 * 60_000);
                onClose();
              }}
            />
            <MenuItem
              icon={<TimerGlyph />}
              label="Start stopwatch"
              onClick={() => {
                props.onStartTimer('stopwatch');
                onClose();
              }}
            />
          </>
        )}
        {props.voteActive ? (
          <MenuItem
            icon={<VoteGlyph />}
            label="End voting"
            onClick={() => {
              props.onEndVote();
              onClose();
            }}
          />
        ) : (
          <MenuItem
            icon={<VoteGlyph />}
            label="Start voting"
            onClick={() => {
              props.onStartVote(3);
              onClose();
            }}
          />
        )}
      </MenuAccordionSection>
    </ContextMenu>
  );
}

// Clock face — the Session category glyph.
function SessionGlyph() {
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
      <circle cx="8" cy="8.5" r="5.5" />
      <path d="M8 5.5V8.5L10 10M8 2.5V1" />
    </svg>
  );
}

// A timer glyph (reuses the clock face) for the timer rows.
function TimerGlyph() {
  return <SessionGlyph />;
}

// Three dots — the voting glyph.
function VoteGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="4.5" cy="8" r="1.6" />
      <circle cx="8" cy="8" r="1.6" />
      <circle cx="11.5" cy="8" r="1.6" />
    </svg>
  );
}

// 6-hex or fall back to white for the native colour input (it can't take
// 'transparent' or named colours).
function hexish(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff';
}

// A small preset palette for the inline colour picker. The "+" custom chip
// still opens the OS picker for anything off-palette.
const PRESET_COLORS = [
  '#0f172a',
  '#64748b',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#0ea5e9',
  '#6366f1',
  '#ec4899',
];

// One labelled colour row inside the Colours section: the label + current
// swatch toggle an inline preset palette (clicking the row again closes it,
// so the picker never gets stuck open). A "+" chip opens the OS picker for a
// custom colour.
function ColourRow({
  label,
  value,
  open,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (color: string) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span>{label}</span>
        <span
          className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600"
          style={{ backgroundColor: hexish(value) }}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="flex flex-wrap items-center gap-1 px-3 pb-2 pt-0.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => onChange(c)}
              className={`h-5 w-5 rounded border transition ${
                value.toLowerCase() === c.toLowerCase()
                  ? 'border-brand-500 ring-1 ring-brand-400'
                  : 'border-slate-300 hover:scale-110 dark:border-slate-600'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 text-[11px] leading-none text-slate-500 dark:border-slate-600"
            aria-label={`Custom ${label} colour`}
          >
            +
            <input
              type="color"
              value={hexish(value)}
              onChange={(e) => onChange(e.target.value)}
              className="absolute h-0 w-0 opacity-0"
            />
          </label>
        </div>
      ) : null}
    </div>
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

type IconPos = 'left' | 'right' | 'above' | 'below';

// A small arrow pointing in `dir` (one up-arrow path, rotated).
function DirArrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <path d="M6 2.5V9.5M3 5.5 6 2.5 9 5.5" />
    </svg>
  );
}

// The inline-icon placement picker laid out as a cross (Top / Left / Right /
// Bottom around an empty centre), each cell an arrow + label.
function IconPositionGrid({
  current,
  onPick,
}: {
  current: string;
  onPick: (pos: IconPos) => void;
}) {
  const cell = (key: IconPos, label: string, dir: 'up' | 'down' | 'left' | 'right') => (
    <button
      type="button"
      aria-pressed={current === key}
      onClick={() => onPick(key)}
      className={`flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition ${
        current === key
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      <DirArrow dir={dir} />
      {label}
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-1 px-2 pb-1.5">
      <span />
      {cell('above', 'Top', 'up')}
      <span />
      {cell('left', 'Left', 'left')}
      <span />
      {cell('right', 'Right', 'right')}
      <span />
      {cell('below', 'Bottom', 'down')}
      <span />
    </div>
  );
}

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

// A serif "A" — the "Text" category glyph.
function TextGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <text
        x="8"
        y="12"
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fontFamily="Georgia, serif"
      >
        A
      </text>
    </svg>
  );
}

// A square toggle for the arrow Text category (B / I / U / S).
function TextToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
        active
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
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
