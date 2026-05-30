import { useState } from 'react';
import type {
  BackgroundPattern,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextSize,
} from '@livediagram/diagram';
import { THEMES, type ThemeId } from '@/lib/themes';
import { MovablePanel } from './MovablePanel';
import { Tooltip } from './Tooltip';

export type SelectedElementControls = {
  textSize: TextSize | null;
  textAlignX: TextAlignX | null;
  textAlignY: TextAlignY | null;
  textColor: string | null;
  fillColor: string | null;
  strokeColor: string | null;
  opacity: number;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onSetTextSize: (size: TextSize) => void;
  onSetTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  onSetTextColor: (color: string) => void;
  onSetFillColor: (color: string) => void;
  onSetStrokeColor: (color: string) => void;
  onSetOpacity: (opacity: number) => void;
};

export type TabSectionControls = {
  backgroundPattern: BackgroundPattern;
  backgroundColor: string;
  patternColor: string;
  themeId: ThemeId;
  hasContent: boolean;
  onSetBackgroundPattern: (pattern: BackgroundPattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetPatternColor: (color: string) => void;
  onSetTheme: (id: ThemeId) => void;
  onClearTabContent: () => void;
};

type CommandPaletteProps = {
  position: { x: number; y: number } | null;
  minimized: boolean;
  selection: SelectedElementControls | null;
  tab: TabSectionControls;
  onMoveTo: (x: number, y: number) => void;
  onToggleMinimized: () => void;
  onAddShape: (kind: ShapeKind) => void;
  onAddText: () => void;
  onAddSticky: () => void;
};

export function CommandPalette(props: CommandPaletteProps) {
  // Minimised state is rendered by Canvas's bottom dock — see DockButton.
  if (props.minimized) return null;
  return <OpenPalette {...props} />;
}

function OpenPalette({
  position,
  selection,
  tab,
  onMoveTo,
  onToggleMinimized,
  onAddShape,
  onAddText,
  onAddSticky,
}: CommandPaletteProps) {
  return (
    <MovablePanel
      title="Palette"
      position={position}
      defaultCorner="top-right"
      width="w-56"
      onMoveTo={onMoveTo}
      onMinimize={onToggleMinimized}
    >
      <div className="px-2 pb-2">
        {/* Shape primitives. Wraps to a second row once the palette runs
            out of horizontal room. Ordered by frequency / familiarity:
            primitive geometry first, then flowchart-vocabulary shapes. */}
        <div className="flex flex-wrap items-center gap-1">
          <IconButton
            label="Add square"
            description="Drop a new square shape on the canvas."
            onClick={() => onAddShape('square')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <rect
                x="3"
                y="3"
                width="12"
                height="12"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add circle"
            description="Drop a new circle shape on the canvas."
            onClick={() => onAddShape('circle')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </IconButton>
          <IconButton
            label="Add diamond"
            description="Drop a diamond shape (decision node, UML-style)."
            onClick={() => onAddShape('diamond')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <polygon
                points="9,2.5 15.5,9 9,15.5 2.5,9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add cylinder"
            description="Drop a cylinder (database / storage in flowcharts)."
            onClick={() => onAddShape('cylinder')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d="M3 5 L3 13 A6 1.8 0 0 0 15 13 L15 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <ellipse
                cx="9"
                cy="5"
                rx="6"
                ry="1.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add parallelogram"
            description="Drop a parallelogram (input/output in flowcharts)."
            onClick={() => onAddShape('parallelogram')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <polygon
                points="5,3 16,3 13,15 2,15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add hexagon"
            description="Drop a hexagon (preparation / labelled milestone)."
            onClick={() => onAddShape('hexagon')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <polygon
                points="5,3 13,3 16,9 13,15 5,15 2,9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add document"
            description="Drop a document shape (output document in flowcharts)."
            onClick={() => onAddShape('document')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d="M3 3 L15 3 L15 13 C13 15.3 11 11.8 9 13.5 C7 15.3 5 11.8 3 13.5 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add stadium"
            description="Drop a stadium / pill shape (Start / End in flowcharts)."
            onClick={() => onAddShape('stadium')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <rect
                x="1.5"
                y="6"
                width="15"
                height="6"
                rx="3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
          </IconButton>
        </div>
        <div className="my-1 h-px bg-slate-100" />
        <div className="flex items-center gap-1">
          <IconButton
            label="Add text"
            description="Drop a draggable text element you can edit by double-clicking."
            onClick={onAddText}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d="M3 5h12M9 5v9M6.5 14h5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add sticky note"
            description="Drop a yellow sticky note for short multi-line annotations."
            onClick={onAddSticky}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d="M3 3h9l3 3v9H3z"
                fill="rgb(254 243 199)"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 3v3h3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
        </div>
      </div>

      {selection ? <SelectedElementSection selection={selection} /> : <TabSection tab={tab} />}
    </MovablePanel>
  );
}

function SelectedElementSection({ selection }: { selection: SelectedElementControls }) {
  const [open, setOpen] = useState<{
    appearance: boolean;
    layer: boolean;
    text: boolean;
    colours: boolean;
  }>({ appearance: false, layer: false, text: false, colours: false });
  const toggle = (key: keyof typeof open) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const showText = selection.textSize !== null || selection.textAlignX !== null;
  const showColours =
    selection.textColor !== null || selection.fillColor !== null || selection.strokeColor !== null;

  return (
    <div className="flex flex-col border-t border-slate-200">
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Selected Element
      </p>

      <Accordion title="Appearance" open={open.appearance} onToggle={() => toggle('appearance')}>
        <p className="text-[10px] font-medium text-slate-500">Opacity</p>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(selection.opacity * 100)}
            onChange={(e) => selection.onSetOpacity(Number(e.target.value) / 100)}
            aria-label="Opacity"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500"
          />
          <span className="w-10 text-right text-xs font-medium text-slate-700">
            {Math.round(selection.opacity * 100)}%
          </span>
        </div>
      </Accordion>

      <Accordion title="Layer" open={open.layer} onToggle={() => toggle('layer')}>
        <div className="flex items-center gap-1">
          <Tooltip title="Bring to front" description="Render this element above everything else.">
            <LabelButton onClick={selection.onBringToFront} label="Front">
              <BringToFrontIcon />
            </LabelButton>
          </Tooltip>
          <Tooltip title="Send to back" description="Render this element behind everything else.">
            <LabelButton onClick={selection.onSendToBack} label="Back">
              <SendToBackIcon />
            </LabelButton>
          </Tooltip>
        </div>
      </Accordion>

      {showText ? (
        <Accordion title="Text" open={open.text} onToggle={() => toggle('text')}>
          {selection.textSize !== null ? (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-medium text-slate-500">Size</p>
              <div className="grid grid-cols-4 gap-1">
                <Tooltip title="Scale" description="Auto-fit the label to the element's size.">
                  <SizeButton
                    active={selection.textSize === 'scale'}
                    onClick={() => selection.onSetTextSize('scale')}
                  >
                    <ScaleIcon />
                  </SizeButton>
                </Tooltip>
                <Tooltip title="Small" description="Fixed small font size.">
                  <SizeButton
                    active={selection.textSize === 'sm'}
                    onClick={() => selection.onSetTextSize('sm')}
                  >
                    <DotsIcon count={1} />
                  </SizeButton>
                </Tooltip>
                <Tooltip title="Medium" description="Fixed medium font size.">
                  <SizeButton
                    active={selection.textSize === 'md'}
                    onClick={() => selection.onSetTextSize('md')}
                  >
                    <DotsIcon count={2} />
                  </SizeButton>
                </Tooltip>
                <Tooltip title="Large" description="Fixed large font size.">
                  <SizeButton
                    active={selection.textSize === 'lg'}
                    onClick={() => selection.onSetTextSize('lg')}
                  >
                    <DotsIcon count={3} />
                  </SizeButton>
                </Tooltip>
              </div>
            </div>
          ) : null}
          {selection.textAlignX !== null && selection.textAlignY !== null ? (
            <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-medium text-slate-500">Alignment</p>
              <AlignmentGrid
                alignX={selection.textAlignX}
                alignY={selection.textAlignY}
                onChange={selection.onSetTextAlign}
              />
            </div>
          ) : null}
        </Accordion>
      ) : null}

      {showColours ? (
        <Accordion title="Colours" open={open.colours} onToggle={() => toggle('colours')}>
          <div className="flex flex-wrap items-stretch gap-1">
            {selection.textColor !== null ? (
              <Tooltip title="Text colour" description="Set the colour of the element's label.">
                <ColorSwatch
                  label="Text"
                  value={selection.textColor}
                  onChange={selection.onSetTextColor}
                />
              </Tooltip>
            ) : null}
            {selection.fillColor !== null ? (
              <Tooltip title="Background" description="The element's fill colour.">
                <ColorSwatch
                  label="Background"
                  value={selection.fillColor}
                  onChange={selection.onSetFillColor}
                />
              </Tooltip>
            ) : null}
            {selection.strokeColor !== null ? (
              <Tooltip title="Border" description="The element's outline colour.">
                <ColorSwatch
                  label="Border"
                  value={selection.strokeColor}
                  onChange={selection.onSetStrokeColor}
                />
              </Tooltip>
            ) : null}
          </div>
        </Accordion>
      ) : null}
    </div>
  );
}

function TabSection({ tab }: { tab: TabSectionControls }) {
  const [open, setOpen] = useState<{ theme: boolean; background: boolean; content: boolean }>({
    theme: false,
    background: false,
    content: false,
  });
  const toggle = (key: keyof typeof open) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col border-t border-slate-200">
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Current Tab
      </p>
      <Accordion title="Theme" open={open.theme} onToggle={() => toggle('theme')}>
        <p className="text-[10px] font-medium text-slate-500">
          Sets the canvas backdrop + the default colours for new elements. Existing elements
          aren&apos;t recoloured.
        </p>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {THEMES.map((t) => {
            const active = tab.themeId === t.id;
            // Border / dot colours come from the theme's element-stroke (or
            // pattern colour when the theme is the brand default).
            const dot = t.elementStroke ?? t.patternColor;
            const swatch = t.elementFill ?? '#ffffff';
            return (
              <Tooltip
                key={t.id}
                title={t.label}
                description="Applies the theme's background and new-element colours."
                block
              >
                <button
                  type="button"
                  onClick={() => tab.onSetTheme(t.id)}
                  aria-pressed={active}
                  className={
                    active
                      ? 'flex w-full flex-col items-center gap-1 rounded-md border border-brand-400 bg-brand-50 p-1.5 text-[10px] font-medium text-brand-800'
                      : 'flex w-full flex-col items-center gap-1 rounded-md border border-slate-200 bg-white p-1.5 text-[10px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40'
                  }
                >
                  <span
                    aria-hidden
                    style={{ backgroundColor: t.backgroundColor }}
                    className="flex h-7 w-full items-center justify-center rounded-sm border border-slate-200"
                  >
                    <span
                      style={{ backgroundColor: swatch, borderColor: dot }}
                      className="h-3 w-3 rounded-sm border"
                    />
                  </span>
                  <span>{t.label}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </Accordion>
      <Accordion title="Background" open={open.background} onToggle={() => toggle('background')}>
        <p className="text-[10px] font-medium text-slate-500">Pattern</p>
        <div className="mt-1 grid grid-cols-3 gap-1">
          <Tooltip title="Grid" description="Subtle dot grid background.">
            <PatternButton
              active={tab.backgroundPattern === 'grid'}
              onClick={() => tab.onSetBackgroundPattern('grid')}
              label="Grid"
            >
              <BackgroundGridIcon />
            </PatternButton>
          </Tooltip>
          <Tooltip title="Blank" description="No background pattern.">
            <PatternButton
              active={tab.backgroundPattern === 'blank'}
              onClick={() => tab.onSetBackgroundPattern('blank')}
              label="Blank"
            >
              <BackgroundBlankIcon />
            </PatternButton>
          </Tooltip>
          <Tooltip title="Lines" description="Horizontal ruled lines.">
            <PatternButton
              active={tab.backgroundPattern === 'lines'}
              onClick={() => tab.onSetBackgroundPattern('lines')}
              label="Lines"
            >
              <BackgroundLinesIcon />
            </PatternButton>
          </Tooltip>
          <Tooltip title="Graph" description="Square graph paper.">
            <PatternButton
              active={tab.backgroundPattern === 'graph'}
              onClick={() => tab.onSetBackgroundPattern('graph')}
              label="Graph"
            >
              <BackgroundGraphIcon />
            </PatternButton>
          </Tooltip>
          <Tooltip title="Crosshatch" description="Diagonal crosshatch pattern.">
            <PatternButton
              active={tab.backgroundPattern === 'crosshatch'}
              onClick={() => tab.onSetBackgroundPattern('crosshatch')}
              label="Cross"
            >
              <BackgroundCrosshatchIcon />
            </PatternButton>
          </Tooltip>
          <Tooltip title="Confetti" description="Multi-colour dots — pattern colour ignored.">
            <PatternButton
              active={tab.backgroundPattern === 'confetti'}
              onClick={() => tab.onSetBackgroundPattern('confetti')}
              label="Confetti"
            >
              <BackgroundConfettiIcon />
            </PatternButton>
          </Tooltip>
        </div>
        <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500">
          Colours
        </p>
        <div className="mt-1 flex items-stretch gap-1">
          <Tooltip title="Canvas colour" description="The colour of the canvas background.">
            <ColorSwatch
              label="Canvas"
              value={tab.backgroundColor}
              onChange={tab.onSetBackgroundColor}
            />
          </Tooltip>
          <Tooltip title="Pattern colour" description="The colour of the grid dots or ruled lines.">
            <ColorSwatch
              label="Pattern"
              value={tab.patternColor}
              onChange={tab.onSetPatternColor}
            />
          </Tooltip>
        </div>
      </Accordion>

      <Accordion title="Content" open={open.content} onToggle={() => toggle('content')}>
        <Tooltip
          title="Remove all content"
          description="Delete every element on this tab. This is undoable."
        >
          <button
            type="button"
            onClick={tab.onClearTabContent}
            disabled={!tab.hasContent}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 transition enabled:hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2.5 4h11" />
              <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
              <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
            </svg>
            Remove all content
          </button>
        </Tooltip>
      </Accordion>
    </div>
  );
}

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <span>{title}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden
          className="transition-transform duration-200 ease-out"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function LabelButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
    >
      <span className="text-slate-500">{children}</span>
      {label}
    </button>
  );
}

function ScaleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8h10" />
      <path d="M3 8l2 -2M3 8l2 2" />
      <path d="M13 8l-2 -2M13 8l-2 2" />
    </svg>
  );
}

function DotsIcon({ count }: { count: 1 | 2 | 3 }) {
  // Concentric size cue: 1 small dot, 2 mid dots, 3 larger dots. Each
  // dot's radius scales with `count` so the visual weight reads as
  // "size" at a glance.
  const radii = count === 1 ? [1.4] : count === 2 ? [1.8, 1.8] : [2.2, 2.2, 2.2];
  const spacing = count === 1 ? [8] : count === 2 ? [5, 11] : [3.5, 8, 12.5];
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      {radii.map((r, i) => (
        <circle key={i} cx={spacing[i]} cy={8} r={r} />
      ))}
    </svg>
  );
}

function SizeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base = 'rounded-md px-1.5 py-1 text-xs font-medium transition';
  const styled = active
    ? 'bg-brand-100 text-brand-700'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  return (
    <button type="button" onClick={onClick} className={`${base} ${styled}`}>
      {children}
    </button>
  );
}

function PatternButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const base = 'flex flex-col items-center gap-1 rounded-md p-2 transition';
  const styled = active
    ? 'bg-brand-100 text-brand-700'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  return (
    <button type="button" onClick={onClick} className={`${base} ${styled}`}>
      {children}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function BackgroundGridIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      {Array.from({ length: 4 }).flatMap((_, i) =>
        Array.from({ length: 3 }).map((__, j) => (
          <circle key={`${i}-${j}`} cx={4 + i * 6} cy={4 + j * 6} r="0.8" fill="currentColor" />
        )),
      )}
    </svg>
  );
}

function BackgroundBlankIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
    </svg>
  );
}

function BackgroundLinesIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth="0.7" />
      <line x1="2" y1="11" x2="26" y2="11" stroke="currentColor" strokeWidth="0.7" />
      <line x1="2" y1="16" x2="26" y2="16" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

function BackgroundGraphIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      {[5, 10, 15].map((y) => (
        <line key={`h${y}`} x1="0" y1={y} x2="28" y2={y} stroke="currentColor" strokeWidth="0.4" />
      ))}
      {[5, 10, 15, 20, 25].map((x) => (
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="20" stroke="currentColor" strokeWidth="0.4" />
      ))}
    </svg>
  );
}

function BackgroundCrosshatchIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <line x1="0" y1="6" x2="22" y2="20" stroke="currentColor" strokeWidth="0.5" />
      <line x1="6" y1="0" x2="28" y2="14" stroke="currentColor" strokeWidth="0.5" />
      <line x1="0" y1="14" x2="14" y2="0" stroke="currentColor" strokeWidth="0.5" />
      <line x1="14" y1="20" x2="28" y2="6" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  );
}

function BackgroundConfettiIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <circle cx="5" cy="6" r="1.3" fill="rgb(248 113 113)" />
      <circle cx="13" cy="4" r="1" fill="rgb(96 165 250)" />
      <circle cx="22" cy="8" r="1.3" fill="rgb(250 204 21)" />
      <circle cx="8" cy="14" r="1.3" fill="rgb(167 139 250)" />
      <circle cx="18" cy="13" r="1" fill="rgb(52 211 153)" />
      <circle cx="24" cy="16" r="1.3" fill="rgb(236 72 153)" />
    </svg>
  );
}

const ALIGN_GRID: { x: TextAlignX; y: TextAlignY }[] = [
  { y: 'top', x: 'left' },
  { y: 'top', x: 'center' },
  { y: 'top', x: 'right' },
  { y: 'middle', x: 'left' },
  { y: 'middle', x: 'center' },
  { y: 'middle', x: 'right' },
  { y: 'bottom', x: 'left' },
  { y: 'bottom', x: 'center' },
  { y: 'bottom', x: 'right' },
];

function alignLabel(x: TextAlignX, y: TextAlignY): string {
  const yLabel = y === 'top' ? 'Top' : y === 'bottom' ? 'Bottom' : 'Middle';
  const xLabel = x === 'left' ? 'left' : x === 'right' ? 'right' : 'centre';
  return `${yLabel} ${xLabel}`;
}

function AlignmentGrid({
  alignX,
  alignY,
  onChange,
}: {
  alignX: TextAlignX;
  alignY: TextAlignY;
  onChange: (x: TextAlignX, y: TextAlignY) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {ALIGN_GRID.map(({ x, y }) => {
        const active = alignX === x && alignY === y;
        return (
          <Tooltip
            key={`${y}-${x}`}
            title={alignLabel(x, y)}
            description="Align text to this corner of the element."
          >
            <button
              type="button"
              onClick={() => onChange(x, y)}
              aria-label={alignLabel(x, y)}
              aria-pressed={active}
              className={
                active
                  ? 'flex h-7 w-full items-center justify-center rounded-md bg-brand-100 text-brand-700'
                  : 'flex h-7 w-full items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900'
              }
            >
              <AlignIcon x={x} y={y} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function AlignIcon({ x, y }: { x: TextAlignX; y: TextAlignY }) {
  const ix = x === 'left' ? 2 : x === 'right' ? 9 : 5.5;
  const iy = y === 'top' ? 3 : y === 'bottom' ? 10 : 6.5;
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect x={ix} y={iy} width="5" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="relative flex flex-1 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
      <span
        aria-hidden
        className="h-4 w-4 rounded border border-slate-300"
        style={{ backgroundColor: value }}
      />
      <span className="flex-1">{label}</span>
      <input
        type="color"
        value={hexish(value)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} color`}
        className="absolute h-0 w-0 opacity-0"
      />
    </label>
  );
}

function hexish(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return '#ffffff';
}

type IconButtonProps = {
  label: string;
  description: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
};

function IconButton({ label, description, onClick, children, disabled }: IconButtonProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
  if (disabled) return button;
  return (
    <Tooltip title={label} description={description}>
      {button}
    </Tooltip>
  );
}

function BringToFrontIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="7" height="7" rx="1" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="1" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}

function SendToBackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="currentColor" fillOpacity="0.18" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="1" />
    </svg>
  );
}
