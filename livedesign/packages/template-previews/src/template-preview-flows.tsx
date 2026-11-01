import type { ReactElement, ReactNode } from 'react';
import {
  LOGO_EXPLORATIONS,
  WIREFRAME_FLOWS,
  isLogoExplorationKind,
  isWireframeFlowKind,
  type LogoExplorationKind,
  type TemplateKind,
  type WireframeFlowKind,
} from '@livedesign/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import {
  BAR,
  Browser,
  INK,
  Laptop,
  PIC,
  Phone,
  SKY,
  Tablet,
  Watch,
  type Box,
} from './wireframe-devices';

// Group flows: the wireframe flows and logo explorations added after the first five flows
// (docs/specs/007-editor/wireframe-pages.md "Templates", logo-pages.md "Logo layouts"). Both are drawn from their
// template's own data, so a tile always shows the screens or layouts the template makes: each screen as a small
// glyph of its layout in its device, each layout as a small glyph on its artboard. Hover story: the screens' (or
// marks') accents light up in turn. The first five flows keep their hand-drawn tiles in group 26.
const FIRST_FIVE: ReadonlySet<TemplateKind> = new Set([
  'wireframe-mobile-app',
  'wireframe-website',
  'wireframe-dashboard',
  'wireframe-tablet-app',
  'wireframe-watch-app',
]);

const svg = (children: ReactNode) => (
  <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
    {children}
  </svg>
);

// An accent that lights on hover, `at` ms into the story.
function lit(at: number) {
  return { className: 'pv-pulse', style: pv({ '--pv-at': `${at}ms` }) };
}

// ---- Screens ----

type Glyph =
  | 'hero'
  | 'feed'
  | 'stories'
  | 'grid'
  | 'list'
  | 'form'
  | 'player'
  | 'map'
  | 'chat'
  | 'columns'
  | 'chart'
  | 'article'
  | 'pass'
  | 'calendar'
  | 'profile'
  | 'empty'
  | 'ring';

// Each wireframe layout's glyph: what the screen reads as at a glance.
const GLYPH: Readonly<Record<string, Glyph>> = {
  'wf-onboarding': 'hero',
  'wf-landing-page': 'hero',
  'wf-product-detail': 'hero',
  'wf-home-feed': 'feed',
  'wf-post-detail': 'feed',
  'wf-blog': 'feed',
  'wf-stories': 'stories',
  'wf-shop-grid': 'grid',
  'wf-gallery': 'grid',
  'wf-team': 'grid',
  'wf-search-results': 'list',
  'wf-inbox': 'list',
  'wf-notifications': 'list',
  'wf-task-list': 'list',
  'wf-settings': 'list',
  'wf-cart': 'list',
  'wf-help-center': 'list',
  'wf-order-tracking': 'list',
  'wf-data-table': 'list',
  'wf-sign-in': 'form',
  'wf-sign-up': 'form',
  'wf-verify-code': 'form',
  'wf-permissions': 'form',
  'wf-checkout': 'form',
  'wf-contact': 'form',
  'wf-edit-profile': 'form',
  'wf-compose-post': 'form',
  'wf-flight-search': 'form',
  'wf-music-player': 'player',
  'wf-video-player': 'player',
  'wf-podcast': 'player',
  'wf-places': 'map',
  'wf-ride': 'map',
  'wf-chat': 'chat',
  'wf-kanban': 'columns',
  'wf-pricing': 'columns',
  'wf-dashboard': 'chart',
  'wf-article': 'article',
  'wf-boarding-pass': 'pass',
  'wf-calendar': 'calendar',
  'wf-profile': 'profile',
  'wf-empty-state': 'empty',
};

// A line of text, small.
const line = (x: number, y: number, w: number, t: number, fill = BAR) => (
  <rect x={x} y={y} width={w} height={t} rx={t / 2} fill={fill} />
);

// A screen's glyph in its content box `b`, its accent lit at `at`.
function ScreenGlyph({ b, glyph, at }: { b: Box; glyph: Glyph; at: number }) {
  const { x, y, w, h } = b;
  const t = Math.max(0.5, Math.min(1.2, h * 0.05));
  const title = line(x, y, w * 0.6, t * 1.3, INK);
  const button = (
    <rect x={x} y={y + h - t * 2.6} width={w} height={t * 2.4} rx={t} fill={INK} {...lit(at)} />
  );
  switch (glyph) {
    case 'hero':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h * 0.5} rx={t} fill={PIC} />
          {line(x, y + h * 0.56, w * 0.8, t * 1.3, INK)}
          {line(x, y + h * 0.56 + t * 2.4, w * 0.6, t)}
          {button}
        </g>
      );
    case 'feed':
      return (
        <g>
          {title}
          {[0, 1].map((i) => (
            <g key={i}>
              <rect
                x={x}
                y={y + t * 2.6 + i * h * 0.44}
                width={w}
                height={h * 0.28}
                rx={t}
                fill={PIC}
              />
              {line(x, y + t * 3.4 + h * 0.28 + i * h * 0.44, w * 0.7, t)}
            </g>
          ))}
          <circle cx={x + w - t * 1.5} cy={y + t * 0.65} r={t * 0.9} fill={SKY} {...lit(at)} />
        </g>
      );
    case 'stories':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={x + w * (0.17 + i * 0.33)}
              cy={y + w * 0.14}
              r={w * 0.12}
              fill="none"
              stroke={i === 0 ? SKY : BAR}
              strokeWidth={t * 0.6}
              {...(i === 0 ? lit(at) : {})}
            />
          ))}
          <rect x={x} y={y + w * 0.34} width={w} height={h - w * 0.34} rx={t} fill={PIC} />
        </g>
      );
    case 'grid':
      return (
        <g>
          {title}
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={x + (i % 2) * (w * 0.53)}
              y={y + t * 2.6 + Math.floor(i / 2) * ((h - t * 2.6) * 0.52)}
              width={w * 0.47}
              height={(h - t * 2.6) * 0.46}
              rx={t}
              fill={i === 0 ? SKY : PIC}
              {...(i === 0 ? lit(at) : {})}
            />
          ))}
        </g>
      );
    case 'list':
      return (
        <g>
          {title}
          {[0, 1, 2, 3].map((i) => {
            const ry = y + t * 3 + i * ((h - t * 3) / 4);
            return (
              <g key={i}>
                <circle
                  cx={x + t}
                  cy={ry + t * 0.6}
                  r={t * 0.9}
                  fill={i === 0 ? SKY : PIC}
                  {...(i === 0 ? lit(at) : {})}
                />
                {line(x + t * 2.6, ry, w - t * 2.6, t)}
              </g>
            );
          })}
        </g>
      );
    case 'form':
      return (
        <g>
          {title}
          {[0, 1].map((i) => (
            <rect
              key={i}
              x={x}
              y={y + t * 3 + i * t * 4}
              width={w}
              height={t * 2.6}
              rx={t * 0.6}
              fill="none"
              stroke={BAR}
              strokeWidth={t * 0.4}
            />
          ))}
          {button}
        </g>
      );
    case 'player': {
      const art = Math.min(w, h * 0.55);
      return (
        <g>
          <rect x={x + (w - art) / 2} y={y} width={art} height={art} rx={t} fill={PIC} />
          {line(x, y + art + t * 1.6, w, t)}
          <rect
            x={x}
            y={y + art + t * 1.6}
            width={w * 0.45}
            height={t}
            rx={t / 2}
            fill={SKY}
            {...lit(at)}
          />
          <circle cx={x + w / 2} cy={y + h - t * 1.8} r={t * 1.6} fill={INK} />
        </g>
      );
    }
    case 'map':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h * 0.7} rx={t} fill={PIC} />
          <path
            d={`M${x + w * 0.2} ${y + h * 0.55} L${x + w * 0.5} ${y + h * 0.3} L${x + w * 0.75} ${y + h * 0.42}`}
            fill="none"
            stroke={BAR}
            strokeWidth={t * 0.6}
          />
          <circle cx={x + w * 0.75} cy={y + h * 0.42} r={t * 1.3} fill={SKY} {...lit(at)} />
          {line(x, y + h * 0.76, w * 0.7, t * 1.2, INK)}
          {line(x, y + h * 0.76 + t * 2.4, w * 0.5, t)}
        </g>
      );
    case 'chat':
      return (
        <g>
          {[0, 1, 2].map((i) => {
            const mine = i % 2 === 1;
            return (
              <rect
                key={i}
                x={mine ? x + w * 0.35 : x}
                y={y + i * (h * 0.28)}
                width={w * 0.65}
                height={h * 0.18}
                rx={t}
                fill={mine ? SKY : PIC}
                {...(mine ? lit(at) : {})}
              />
            );
          })}
          <rect
            x={x}
            y={y + h - t * 2.4}
            width={w}
            height={t * 2.2}
            rx={t}
            fill="none"
            stroke={BAR}
            strokeWidth={t * 0.4}
          />
        </g>
      );
    case 'columns':
      return (
        <g>
          {title}
          {[0, 1, 2].map((c) => (
            <g key={c}>
              {[0, 1, 2 - c].map((r, i) =>
                r >= 0 ? (
                  <rect
                    key={i}
                    x={x + c * (w * 0.35)}
                    y={y + t * 3 + i * (h * 0.24)}
                    width={w * 0.3}
                    height={h * 0.19}
                    rx={t * 0.6}
                    fill={c === 0 && i === 0 ? SKY : PIC}
                    {...(c === 0 && i === 0 ? lit(at) : {})}
                  />
                ) : null,
              )}
            </g>
          ))}
        </g>
      );
    case 'chart':
      return (
        <g>
          {title}
          {[0.45, 0.7, 0.55, 0.9].map((v, i) => {
            const bh = (h - t * 4) * v;
            return (
              <rect
                key={i}
                x={x + i * (w * 0.26)}
                y={y + h - bh}
                width={w * 0.18}
                height={bh}
                rx={t * 0.5}
                fill={i === 3 ? SKY : PIC}
                {...(i === 3 ? lit(at) : {})}
              />
            );
          })}
        </g>
      );
    case 'article':
      return (
        <g>
          {line(x, y, w * 0.85, t * 1.6, INK)}
          <rect x={x} y={y + t * 3} width={w} height={h * 0.3} rx={t} fill={PIC} {...lit(at)} />
          {[0, 1, 2, 3].map((i) =>
            line(x, y + t * 4 + h * 0.3 + i * t * 2, i === 3 ? w * 0.6 : w, t),
          )}
        </g>
      );
    case 'pass':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h * 0.85} rx={t * 1.2} fill={PIC} />
          {line(x + w * 0.1, y + h * 0.1, w * 0.35, t * 1.6, INK)}
          {line(x + w * 0.55, y + h * 0.1, w * 0.35, t * 1.6, INK)}
          <line
            x1={x + w * 0.1}
            x2={x + w * 0.9}
            y1={y + h * 0.42}
            y2={y + h * 0.42}
            stroke={BAR}
            strokeWidth={t * 0.4}
            strokeDasharray={`${t} ${t * 0.6}`}
          />
          <rect
            x={x + w * 0.25}
            y={y + h * 0.5}
            width={w * 0.5}
            height={h * 0.26}
            fill={INK}
            {...lit(at)}
          />
        </g>
      );
    case 'calendar':
      return (
        <g>
          {title}
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x={x + (i % 4) * (w * 0.26)}
              y={y + t * 3 + Math.floor(i / 4) * ((h - t * 3) * 0.34)}
              width={w * 0.2}
              height={(h - t * 3) * 0.26}
              rx={t * 0.4}
              fill={i === 6 ? SKY : PIC}
              {...(i === 6 ? lit(at) : {})}
            />
          ))}
        </g>
      );
    case 'profile': {
      const r = Math.min(w, h) * 0.18;
      return (
        <g>
          <circle cx={x + w / 2} cy={y + r} r={r} fill={PIC} />
          {line(x + w * 0.2, y + r * 2 + t * 1.4, w * 0.6, t * 1.3, INK)}
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={x + i * (w * 0.35)}
              y={y + r * 2 + t * 4.4}
              width={w * 0.3}
              height={h - (r * 2 + t * 4.4)}
              rx={t * 0.6}
              fill={i === 0 ? SKY : PIC}
              {...(i === 0 ? lit(at) : {})}
            />
          ))}
        </g>
      );
    }
    case 'empty':
      return (
        <g>
          <circle cx={x + w / 2} cy={y + h * 0.3} r={Math.min(w, h) * 0.18} fill={PIC} />
          {line(x + w * 0.15, y + h * 0.55, w * 0.7, t * 1.3, INK)}
          {line(x + w * 0.25, y + h * 0.55 + t * 2.4, w * 0.5, t)}
          {button}
        </g>
      );
    case 'ring':
      return (
        <circle
          cx={x + w / 2}
          cy={y + h / 2}
          r={Math.min(w, h) * 0.38}
          fill="none"
          stroke={SKY}
          strokeWidth={Math.max(0.6, Math.min(w, h) * 0.12)}
          {...lit(at)}
        />
      );
  }
}

// Each device's height to width, and its screen's content box as fractions of the body.
const DEVICE: Readonly<
  Record<
    'iphone' | 'ipad' | 'browser' | 'laptop' | 'watch',
    {
      aspect: number;
      content: [number, number, number, number];
      Frame: (p: Box & { children?: ReactNode }) => ReactElement;
    }
  >
> = {
  iphone: { aspect: 2.5, content: [0.17, 0.13, 0.66, 0.78], Frame: Phone },
  ipad: { aspect: 1.5, content: [0.15, 0.13, 0.7, 0.76], Frame: Tablet },
  browser: { aspect: 0.8, content: [0.09, 0.22, 0.82, 0.7], Frame: Browser },
  laptop: { aspect: 0.72, content: [0.17, 0.1, 0.66, 0.66], Frame: Laptop },
  watch: { aspect: 2.1, content: [0.2, 0.3, 0.6, 0.4], Frame: Watch },
};

const AREA = { x: 3, y: 3, w: 74, h: 44 };
const GAP = 2.5;

// The largest grid of `n` devices of the given aspect that fits the tile, centred.
function deviceGrid(n: number, aspect: number): Box[] {
  let best = { cols: n, rows: 1, w: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min(
      (AREA.w - (cols - 1) * GAP) / cols,
      (AREA.h - (rows - 1) * GAP) / rows / aspect,
    );
    if (w > best.w) best = { cols, rows, w };
  }
  const w = best.w;
  const h = w * aspect;
  const gridW = best.cols * w + (best.cols - 1) * GAP;
  const gridH = best.rows * h + (best.rows - 1) * GAP;
  const x0 = AREA.x + (AREA.w - gridW) / 2;
  const y0 = AREA.y + (AREA.h - gridH) / 2;
  return Array.from({ length: n }, (_, i) => ({
    x: x0 + (i % best.cols) * (w + GAP),
    y: y0 + Math.floor(i / best.cols) * (h + GAP),
    w,
    h,
  }));
}

function flowPreview(kind: WireframeFlowKind): ReactElement {
  const flow = WIREFRAME_FLOWS[kind];
  const d = DEVICE[flow.device as keyof typeof DEVICE] ?? DEVICE.iphone;
  const boxes = deviceGrid(flow.screens.length, d.aspect);
  return svg(
    boxes.map((b, i) => {
      const [cx, cy, cw, ch] = d.content;
      const content = { x: b.x + b.w * cx, y: b.y + b.h * cy, w: b.w * cw, h: b.h * ch };
      const layout = flow.screens[i]!.layout;
      const glyph = flow.device === 'watch' ? 'ring' : (GLYPH[layout] ?? 'feed');
      return (
        <d.Frame key={i} {...b}>
          <ScreenGlyph b={content} glyph={glyph} at={200 + i * 220} />
        </d.Frame>
      );
    }),
  );
}

// ---- Logo explorations ----

const ESPRESSO = 'rgb(59 31 20)';
const SUNRISE = 'rgb(245 158 11)';

// A logo layout's glyph centred at (cx, cy), `s` its unit, its mark lit at `at`.
function LogoGlyph({
  id,
  cx,
  cy,
  s,
  at,
}: {
  id: string;
  cx: number;
  cy: number;
  s: number;
  at: number;
}) {
  const name = (x: number, y: number, w = s * 3.2) => (
    <rect x={x} y={y} width={w} height={s * 0.7} rx={s * 0.2} fill={ESPRESSO} />
  );
  const tag = (x: number, y: number, w = s * 2.4) => (
    <rect x={x} y={y} width={w} height={s * 0.35} rx={s * 0.15} fill={BAR} />
  );
  const disc = (x: number, y: number, r = s * 0.8) => (
    <circle cx={x} cy={y} r={r} fill={SUNRISE} {...lit(at)} />
  );
  switch (id) {
    case 'logo-icon-above':
      return (
        <g>
          {disc(cx, cy - s * 0.8)}
          {name(cx - s * 1.6, cy + s * 0.4)}
        </g>
      );
    case 'logo-icon-beside':
      return (
        <g>
          <rect
            x={cx - s * 2.6}
            y={cy - s * 0.8}
            width={s * 1.6}
            height={s * 1.6}
            rx={s * 0.4}
            fill={SUNRISE}
            {...lit(at)}
          />
          {name(cx - s * 0.6, cy - s * 0.6)}
          {tag(cx - s * 0.6, cy + s * 0.4)}
        </g>
      );
    case 'logo-stacked':
      return (
        <g>
          {disc(cx, cy - s * 1.1, s * 0.7)}
          {name(cx - s * 1.6, cy)}
          {tag(cx - s * 1.2, cy + s * 1.1)}
        </g>
      );
    case 'logo-icon-right':
      return (
        <g>
          {name(cx - s * 2.6, cy - s * 0.6)}
          {tag(cx - s * 1.8, cy + s * 0.4)}
          {disc(cx + s * 1.7, cy)}
        </g>
      );
    case 'logo-divided':
      return (
        <g>
          {disc(cx - s * 2, cy)}
          <rect x={cx - s * 0.9} y={cy - s} width={s * 0.15} height={s * 2} fill={BAR} />
          {name(cx - s * 0.4, cy - s * 0.6, s * 2.6)}
          {tag(cx - s * 0.4, cy + s * 0.4, s * 2)}
        </g>
      );
    case 'logo-pill':
      return (
        <g>
          <rect
            x={cx - s * 3}
            y={cy - s}
            width={s * 6}
            height={s * 2}
            rx={s}
            fill="none"
            stroke={ESPRESSO}
            strokeWidth={s * 0.18}
          />
          {disc(cx - s * 1.8, cy, s * 0.55)}
          {name(cx - s * 0.9, cy - s * 0.35, s * 3)}
        </g>
      );
    case 'logo-icon-below':
      return (
        <g>
          {name(cx - s * 1.6, cy - s * 1.4)}
          {tag(cx - s * 1.2, cy - s * 0.4)}
          {disc(cx, cy + s * 0.9, s * 0.7)}
        </g>
      );
    case 'logo-wordmark':
      return (
        <g>
          <rect
            x={cx - s * 2.4}
            y={cy - s * 0.6}
            width={s * 4.8}
            height={s}
            rx={s * 0.25}
            fill={ESPRESSO}
            {...lit(at)}
          />
          {tag(cx - s * 1.4, cy + s * 0.8, s * 2.8)}
        </g>
      );
    case 'logo-monogram':
      return (
        <g>
          <rect
            x={cx - s * 1.2}
            y={cy - s * 1.2}
            width={s * 2.4}
            height={s * 2.4}
            rx={s * 0.5}
            fill="none"
            stroke={ESPRESSO}
            strokeWidth={s * 0.18}
          />
          <rect
            x={cx - s * 0.7}
            y={cy - s * 0.4}
            width={s * 1.4}
            height={s * 0.8}
            rx={s * 0.2}
            fill={SUNRISE}
            {...lit(at)}
          />
        </g>
      );
    case 'logo-underlined':
      return (
        <g>
          {name(cx - s * 2.2, cy - s * 0.6, s * 4.4)}
          <rect
            x={cx - s * 2.2}
            y={cy + s * 0.4}
            width={s * 1.6}
            height={s * 0.3}
            rx={s * 0.15}
            fill={SUNRISE}
            {...lit(at)}
          />
        </g>
      );
    case 'logo-two-lines':
      return (
        <g>
          {name(cx - s * 2, cy - s * 0.9, s * 4)}
          <rect
            x={cx - s * 2}
            y={cy + s * 0.2}
            width={s * 4}
            height={s * 0.45}
            rx={s * 0.2}
            fill={SUNRISE}
            {...lit(at)}
          />
        </g>
      );
    case 'logo-spaced':
      return (
        <g>
          <rect x={cx - s * 2.6} y={cy - s} width={s * 5.2} height={s * 0.12} fill={BAR} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={cx - s * 2.4 + i * s * 1.05}
              y={cy - s * 0.35}
              width={s * 0.6}
              height={s * 0.7}
              rx={s * 0.15}
              fill={i === 0 ? SUNRISE : ESPRESSO}
              {...(i === 0 ? lit(at) : {})}
            />
          ))}
          <rect x={cx - s * 2.6} y={cy + s * 0.9} width={s * 5.2} height={s * 0.12} fill={BAR} />
        </g>
      );
    case 'logo-initial':
      return (
        <g>
          <circle
            cx={cx - s * 1.6}
            cy={cy}
            r={s * 0.9}
            fill="none"
            stroke={SUNRISE}
            strokeWidth={s * 0.25}
            {...lit(at)}
          />
          {name(cx - s * 0.4, cy - s * 0.35, s * 2.8)}
        </g>
      );
    case 'logo-badge':
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={s * 1.6}
            fill="none"
            stroke={ESPRESSO}
            strokeWidth={s * 0.18}
          />
          {disc(cx, cy, s * 0.7)}
        </g>
      );
    case 'logo-seal':
      return (
        <g>
          <circle cx={cx} cy={cy} r={s * 1.2} fill={ESPRESSO} />
          <circle cx={cx} cy={cy} r={s * 0.5} fill={SUNRISE} {...lit(at)} />
          <circle
            cx={cx}
            cy={cy}
            r={s * 1.6}
            fill="none"
            stroke={BAR}
            strokeWidth={s * 0.12}
            strokeDasharray={`${s * 0.3} ${s * 0.2}`}
          />
        </g>
      );
    case 'logo-hexagon': {
      const r = s * 1.3;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${cx + r * Math.cos(a)},${cy - s * 0.3 + r * Math.sin(a)}`;
      }).join(' ');
      return (
        <g>
          <polygon points={pts} fill="none" stroke={ESPRESSO} strokeWidth={s * 0.18} />
          {disc(cx, cy - s * 0.3, s * 0.5)}
          {tag(cx - s * 1.2, cy + s * 1.3)}
        </g>
      );
    }
    case 'logo-stamp':
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={s * 1.6}
            fill="none"
            stroke={ESPRESSO}
            strokeWidth={s * 0.14}
          />
          <circle
            cx={cx}
            cy={cy}
            r={s * 1.25}
            fill="none"
            stroke={ESPRESSO}
            strokeWidth={s * 0.1}
          />
          <rect
            x={cx - s * 0.6}
            y={cy - s * 0.35}
            width={s * 1.2}
            height={s * 0.7}
            rx={s * 0.2}
            fill={SUNRISE}
            {...lit(at)}
          />
        </g>
      );
    case 'logo-square-badge':
      return (
        <g>
          <rect
            x={cx - s * 1.5}
            y={cy - s * 1.5}
            width={s * 3}
            height={s * 3}
            rx={s * 0.5}
            fill="none"
            stroke={ESPRESSO}
            strokeWidth={s * 0.18}
          />
          {disc(cx, cy - s * 0.4, s * 0.55)}
          {tag(cx - s, cy + s * 0.6, s * 2)}
        </g>
      );
    case 'logo-diamond':
      return (
        <g>
          <polygon
            points={`${cx},${cy - s * 1.5} ${cx + s * 1.3},${cy - s * 0.2} ${cx},${cy + s * 1.1} ${cx - s * 1.3},${cy - s * 0.2}`}
            fill="none"
            stroke={ESPRESSO}
            strokeWidth={s * 0.18}
          />
          <rect
            x={cx - s * 0.45}
            y={cy - s * 0.5}
            width={s * 0.9}
            height={s * 0.6}
            rx={s * 0.15}
            fill={SUNRISE}
            {...lit(at)}
          />
          {tag(cx - s * 1.1, cy + s * 1.35, s * 2.2)}
        </g>
      );
    case 'logo-mark-disc':
      return disc(cx, cy, s * 1.3);
    case 'logo-mark-app':
      return (
        <g>
          <rect
            x={cx - s * 1.3}
            y={cy - s * 1.3}
            width={s * 2.6}
            height={s * 2.6}
            rx={s * 0.6}
            fill={ESPRESSO}
          />
          <circle cx={cx} cy={cy} r={s * 0.7} fill={SUNRISE} {...lit(at)} />
        </g>
      );
    case 'logo-mark-rings':
      return (
        <g>
          <circle
            cx={cx - s * 0.5}
            cy={cy}
            r={s}
            fill="none"
            stroke={ESPRESSO}
            strokeWidth={s * 0.25}
          />
          <circle
            cx={cx + s * 0.5}
            cy={cy}
            r={s}
            fill="none"
            stroke={SUNRISE}
            strokeWidth={s * 0.25}
            {...lit(at)}
          />
        </g>
      );
    case 'logo-mark-initial':
      return (
        <g>
          <circle cx={cx} cy={cy} r={s * 1.3} fill="none" stroke={ESPRESSO} strokeWidth={s * 0.2} />
          <rect
            x={cx - s * 0.35}
            y={cy - s * 0.7}
            width={s * 0.7}
            height={s * 1.4}
            rx={s * 0.15}
            fill={SUNRISE}
            {...lit(at)}
          />
        </g>
      );
    case 'logo-mark-peaks':
      return (
        <g>
          <polygon
            points={`${cx - s * 1.6},${cy + s} ${cx - s * 0.4},${cy - s} ${cx + s * 0.8},${cy + s}`}
            fill={ESPRESSO}
          />
          <polygon
            points={`${cx - s * 0.6},${cy + s} ${cx + s * 0.5},${cy - s * 0.5} ${cx + s * 1.6},${cy + s}`}
            fill={SUNRISE}
            {...lit(at)}
          />
        </g>
      );
    case 'logo-mark-star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? s * 1.4 : s * 0.6;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      }).join(' ');
      return (
        <g>
          <polygon points={pts} fill={ESPRESSO} />
          <circle cx={cx} cy={cy} r={s * 0.4} fill={SUNRISE} {...lit(at)} />
        </g>
      );
    }
    default:
      return disc(cx, cy);
  }
}

function explorationPreview(kind: LogoExplorationKind): ReactElement {
  const layouts = LOGO_EXPLORATIONS[kind];
  // Two rows of artboards: four over three for the seven lockups, three over three for the rest.
  const cols = Math.ceil(layouts.length / 2);
  const w = (AREA.w - (cols - 1) * GAP) / cols;
  const h = (AREA.h - GAP) / 2;
  return svg(
    layouts.map((id, i) => {
      const row = Math.floor(i / cols);
      const inRow = row === 0 ? cols : layouts.length - cols;
      const rowW = inRow * w + (inRow - 1) * GAP;
      const x = AREA.x + (AREA.w - rowW) / 2 + (i % cols) * (w + GAP);
      const y = AREA.y + row * (h + GAP);
      return (
        <g key={id}>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx="1"
            fill="white"
            stroke={BAR}
            strokeWidth="0.6"
          />
          <LogoGlyph
            id={id}
            cx={x + w / 2}
            cy={y + h / 2}
            s={Math.min(w * 0.15, h * 0.17)}
            at={200 + i * 200}
          />
        </g>
      );
    }),
  );
}

export function templatePreviewGroupFlows(kind: TemplateKind): ReactElement | null {
  if (isWireframeFlowKind(kind) && !FIRST_FIVE.has(kind)) return flowPreview(kind);
  if (isLogoExplorationKind(kind)) return explorationPreview(kind);
  return null;
}
