// The window's bottom edge in liveplanner's editor as the help draws it (./planner-chrome has the rest): the corner
// cluster bottom right (ChromeControls and the Session strip) and the bottom bar with the tabs and quick controls
// (TabBar). Same scale as the rest of the kit: about half the real editor.

import { Avatar, Label } from '@liveworkspace/help-site/art/primitives';
import { ChromeCard, HAIR, textW, VDivider, type Person } from './planner-chrome';
import { Glyph, type GlyphName } from './planner-glyphs';

// --- The corner cluster ---------------------------------------------------------------------------------------

type CornerGroup = 'undo' | 'session' | 'board' | 'settings' | 'style' | 'zoom';

/** The corner cluster, its right edge at `right` and top at y, each group its own card: `undo` (Undo, Redo),
 *  `session` (the Timer and Vote, `dotsLeft` on the Vote), `board` (Trash, Card Types), `settings` (the board's
 *  Settings and Style), `style` (Style alone) and `zoom` (minus, the level, plus). */
export function CornerControls({
  right,
  y,
  groups = ['undo', 'board', 'settings'],
  level = '100%',
  dotsLeft,
  clock,
  undoLit = false,
}: {
  right: number;
  y: number;
  groups?: CornerGroup[];
  level?: string;
  dotsLeft?: number;
  clock?: string;
  /** Lights Undo (pressed), and Redo with it (there is now a step to put back). */
  undoLit?: boolean;
}) {
  const H = 22;
  const mid = y + H / 2;
  const widths: Record<CornerGroup, number> = {
    undo: 44,
    session: clock ? 66 : 44,
    board: 44,
    settings: 44,
    style: 22,
    zoom: 74,
  };
  const start = right - groups.reduce((a, g) => a + widths[g], 0) - (groups.length - 1) * 5;
  const lefts = groups.map(
    (_, i) => start + groups.slice(0, i).reduce((a, g) => a + widths[g] + 5, 0),
  );
  return (
    <g>
      {groups.map((g, i) => {
        const x = lefts[i]!;
        const w = widths[g];
        const pair = (a: GlyphName, b: GlyphName, dim = false) => (
          <>
            <VDivider x={x + w / 2} y={y + 4} h={H - 8} />
            <Glyph name={a} x={x + w / 4} y={mid} s={0.85} />
            <g opacity={dim ? 0.4 : 1}>
              <Glyph name={b} x={x + (3 * w) / 4} y={mid} s={0.85} />
            </g>
          </>
        );
        return (
          <ChromeCard key={g} x={x} y={y} w={w} h={H} r={6}>
            {g === 'undo' && undoLit && (
              <rect
                x={x + 3}
                y={y + 3}
                width={w / 2 - 5}
                height={H - 6}
                rx={4}
                className="fill-brand-100"
              />
            )}
            {g === 'undo' && pair('undo', 'redo', !undoLit)}
            {g === 'board' && pair('trash', 'cardTypes')}
            {g === 'settings' && (
              <>
                <VDivider x={x + w / 2} y={y + 4} h={H - 8} />
                <CogGlyph x={x + w / 4} y={mid} />
                <Glyph name="palette" x={x + (3 * w) / 4} y={mid} s={0.85} />
              </>
            )}
            {g === 'style' && <Glyph name="palette" x={x + 11} y={mid} s={0.85} />}
            {g === 'zoom' && (
              <>
                <Glyph name="plus" x={x + w - 10} y={mid} s={0.75} />
                <path
                  d={`M${x + 7} ${mid} h6`}
                  className="stroke-slate-600"
                  strokeWidth={1}
                  strokeLinecap="round"
                />
                <Label
                  x={x + w / 2}
                  y={mid + 0.5}
                  size={9}
                  weight={500}
                  anchor="middle"
                  tone="strong"
                >
                  {level}
                </Label>
              </>
            )}
            {g === 'session' && (
              <>
                <VDivider x={x + w - 22} y={y + 4} h={H - 8} />
                {clock ? (
                  <>
                    <Glyph name="timer" x={x + 10} y={mid} s={0.8} brand />
                    <Label x={x + 17} y={mid + 0.5} size={9} weight={700} tone="accent">
                      {clock}
                    </Label>
                  </>
                ) : (
                  <Glyph name="timer" x={x + 11} y={mid} s={0.85} />
                )}
                <rect
                  x={x + w - 19}
                  y={y + 3}
                  width={16}
                  height={H - 6}
                  rx={4}
                  className={dotsLeft !== undefined ? 'fill-brand-100' : 'fill-white'}
                />
                <Glyph name="vote" x={x + w - 11} y={mid} s={0.85} brand={dotsLeft !== undefined} />
                {dotsLeft !== undefined && (
                  <g>
                    <circle cx={x + w - 4} cy={y + 3} r={4.5} className="fill-brand-500" />
                    <Label
                      x={x + w - 4}
                      y={y + 3.3}
                      size={6.5}
                      weight={700}
                      anchor="middle"
                      tone="onAccent"
                    >
                      {dotsLeft}
                    </Label>
                  </g>
                )}
              </>
            )}
          </ChromeCard>
        );
      })}
    </g>
  );
}

/** The board Settings cog in the corner cluster. */
function CogGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle
        r={3.9}
        className="stroke-slate-600"
        strokeWidth={1.8}
        strokeDasharray="1.5 1.56"
        fill="none"
      />
      <circle r={3} className="stroke-slate-600" strokeWidth={1} fill="none" />
      <circle r={1.2} className="stroke-slate-600" strokeWidth={1} fill="none" />
    </g>
  );
}

// --- The bottom bar -------------------------------------------------------------------------------------------

export const BAR_H = 24;

export type BarTab = {
  name: string;
  kind?: 'board' | 'sheet' | 'dashboard' | 'form';
  lock?: boolean;
  /** A tab a one-tab link leaves out: the eye-off glyph and the muted name. */
  notShared?: boolean;
};

/** The bottom bar across the window: the tabs (each with its kind's icon, the open one a white card standing on
 *  the bar with its ⋯), +, then Get Started, Tools, Settings, notifications and the appearance switch at the
 *  right-hand end. barTabLefts gives each tab's left edge, for placing a callout on one. */
export function BottomBar({
  y,
  w,
  tabs = [{ name: 'Tab 1' }],
  active = 0,
  x = 0,
  controls = true,
  getStarted = true,
  presence = [],
  appearance = 'monitor',
}: {
  y: number;
  w: number;
  tabs?: BarTab[];
  active?: number;
  x?: number;
  controls?: boolean;
  getStarted?: boolean;
  /** Who is on the open tab: initials and colour, drawn as a small stack inside its card. */
  presence?: Person[];
  appearance?: 'monitor' | 'sun' | 'moon';
}) {
  const lefts = barTabLefts(tabs, active, presence.length, x);
  const at = lefts.at(-1)! + barTabW(tabs.at(-1)!, tabs.length - 1 === active, presence.length) + 2;
  const r = x + w;
  return (
    <g>
      <rect x={x} y={y} width={w} height={BAR_H} className="fill-slate-100" />
      <line x1={x} y1={y} x2={x + w} y2={y} className="stroke-slate-200" strokeWidth={HAIR} />
      {tabs.map((t, i) => {
        const on = i === active;
        const tx = lefts[i]!;
        const tw = barTabW(t, on, presence.length);
        // The padlock leads a locked tab, then its kind's icon, then its name.
        const lx = tx + 8 + (t.lock ? 10 : 0);
        const nameX = lx + (t.kind ? 11 : 0);
        return (
          <g key={t.name + i}>
            {on && (
              <path
                d={`M${tx} ${y + BAR_H} V${y + 9} a5 5 0 0 1 5 -5 H${tx + tw - 5} a5 5 0 0 1 5 5 V${y + BAR_H}`}
                className="fill-white stroke-slate-200"
                strokeWidth={HAIR}
              />
            )}
            {t.lock && <Glyph name="lock" x={tx + 11} y={y + 14} s={0.7} brand={on} />}
            {t.kind && (
              <Glyph
                name={t.notShared ? 'eyeOff' : t.kind}
                x={lx + 4}
                y={y + 14.5}
                s={0.7}
                brand={on}
                className={t.notShared ? 'stroke-slate-400' : undefined}
              />
            )}
            <Label
              x={nameX}
              y={y + 14.5}
              size={9}
              weight={on ? 600 : 500}
              className={on ? 'fill-brand-600' : t.notShared ? 'fill-slate-400' : 'fill-slate-600'}
            >
              {t.name}
            </Label>
            {on &&
              presence.map((p, k) => (
                <Avatar
                  key={k}
                  cx={nameX + textW(t.name) + 9 + k * 8}
                  cy={y + 14.5}
                  r={5}
                  initial={p.initial}
                  colour={p.colour}
                />
              ))}
            {on && <Glyph name="dots" x={tx + tw - 10} y={y + 14.5} brand />}
          </g>
        );
      })}
      <Glyph name="plus" x={at + 10} y={y + 14.5} s={0.8} />
      {controls && (
        <g>
          {getStarted && (
            <g>
              <rect
                x={r - 210}
                y={y + 7}
                width={68}
                height={14}
                rx={7}
                className="fill-white stroke-slate-200"
                strokeWidth={HAIR}
              />
              <circle cx={r - 202} cy={y + 14} r={4} className="fill-brand-500" />
              <path
                d={`M${r - 203.2} ${y + 12.2} l2.6 1.8 l-2.6 1.8 Z`}
                className="fill-white help-art-as-drawn"
              />
              <Label x={r - 195} y={y + 14.5} size={8.5} weight={500} tone="strong">
                Get Started
              </Label>
            </g>
          )}
          <Glyph name="tools" x={r - 130} y={y + 14} s={0.85} />
          <Label x={r - 122} y={y + 14.5} size={9} tone="body">
            Tools
          </Label>
          <Glyph name="settings" x={r - 87} y={y + 14} s={0.85} />
          <Label x={r - 79} y={y + 14.5} size={9} tone="body">
            Settings
          </Label>
          <Glyph name="bell" x={r - 28} y={y + 14} s={0.85} />
          <Glyph name={appearance} x={r - 11} y={y + 14} s={0.85} />
        </g>
      )}
    </g>
  );
}

/** A bar tab's width: its padlock, icon and name and, on the open tab, the presence stack and ⋯. */
export function barTabW(t: BarTab, on: boolean, presence = 0): number {
  return Math.round(
    16 +
      (t.kind ? 11 : 0) +
      (t.lock ? 10 : 0) +
      textW(t.name) +
      (on ? 16 + (presence ? presence * 8 + 6 : 0) : 0),
  );
}

/** Each bar tab's left edge, laid end to end from the bar's start. */
export function barTabLefts(tabs: BarTab[], active: number, presence = 0, x = 0): number[] {
  const out: number[] = [];
  let at = x + 8;
  tabs.forEach((t, i) => {
    out.push(at);
    at += barTabW(t, i === active, presence) + 2;
  });
  return out;
}
