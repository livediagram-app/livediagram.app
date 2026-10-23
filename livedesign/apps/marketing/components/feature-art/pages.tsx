// Feature art for Pages mode's pages (docs/specs/019-marketing/marketing-site.md,
// docs/specs/007-editor/pages-mode.md): a page of each kind side by side (a logo, a phone screen and a
// photo), and backgrounds painted from the theme (the export is in ./pages-export). Each is a small mock
// of the real surface, built on ./page-kit so a page reads as paper on the canvas in light and in dark.

import { Frame } from './shared';
import { AMBER, at, INK, Lines, Page, PageLabel, SERIF, SKY, VIOLET } from './page-kit';

const WIRE = 'fill-slate-200 dark:fill-slate-600';

/** A page for each logo and screen: a square logo artboard, a phone wireframe and a photo, side by side. */
export function PagesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* A square artboard: a logo. */}
        <g className="fa-e-in" style={at(0)}>
          <PageLabel x={40} y={21}>
            Logo
          </PageLabel>
          <Page x={40} y={24} w={50} h={50}>
            <circle cx="65" cy="45" r="11" fill="none" stroke={SKY} strokeWidth="3.4" />
            <circle cx="65" cy="45" r="4" fill={VIOLET} />
            <text
              x="65"
              y="67"
              textAnchor="middle"
              fontSize="6"
              fontWeight="800"
              className={INK}
              fill="#1e293b"
            >
              Bloom
            </text>
          </Page>
        </g>
        {/* A phone: a wireframe screen. */}
        <g className="fa-e-in" style={at(0.25)}>
          <PageLabel x={112} y={11}>
            Phone
          </PageLabel>
          <Page x={112} y={14} w={38} h={72}>
            <rect x="125" y="17" width="12" height="3" rx="1.5" fill="#1e293b" />
            <text x="116" y="31" fontSize="5.2" fontWeight="800" className={INK} fill="#1e293b">
              Sign in
            </text>
            <g className={WIRE} fill="#e2e8f0">
              <rect x="116" y="37" width="30" height="7" rx="2" />
              <rect x="116" y="48" width="30" height="7" rx="2" />
            </g>
            <rect x="116" y="61" width="30" height="7" rx="3.5" fill={SKY} />
            <Lines x={122} y={74} w={18} count={1} height={1.4} />
          </Page>
        </g>
        {/* A photo: a picture to edit. */}
        <g className="fa-e-in" style={at(0.5)}>
          <PageLabel x={172} y={25}>
            Photo
          </PageLabel>
          <defs>
            <linearGradient id="pe-photo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="1" stopColor="#e0f2fe" />
            </linearGradient>
          </defs>
          <Page x={172} y={28} w={78} h={46} fill="url(#pe-photo)" className="">
            <circle cx="226" cy="42" r="6" fill="#fde047" />
            <path d="M172 64c16-12 30-10 40-4s20-6 38-2v16h-78z" fill="#4ade80" />
            <path d="M172 70c24-6 50-4 78-2v6h-78z" fill="#15803d" />
          </Page>
        </g>
      </svg>
    </Frame>
  );
}

/** Backgrounds from your theme: a logo on a tint with a grid, a gradient with dots, and a dark page whose ink follows it. */
export function PagesBackgroundsArt() {
  const pages: {
    x: number;
    label: string;
    fill: string;
    className: string;
    pattern: string;
    ink: string;
    inkClass?: string;
    accent: string;
  }[] = [
    {
      x: 50,
      label: 'Theme tint',
      fill: '#e0f2fe',
      className: 'fill-sky-100 dark:fill-sky-950',
      pattern: 'url(#pe-grid)',
      ink: '#0c4a6e',
      inkClass: 'fill-sky-900 dark:fill-sky-100',
      accent: SKY,
    },
    {
      x: 130,
      label: 'Gradient',
      fill: 'url(#pe-dusk)',
      className: '',
      pattern: 'url(#pe-dots)',
      ink: '#7c2d12',
      accent: '#ea580c',
    },
    {
      x: 210,
      label: 'Dark page',
      fill: '#0f172a',
      className: 'dark:fill-slate-950',
      pattern: 'url(#pe-ruled)',
      ink: '#f8fafc',
      accent: '#7dd3fc',
    },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="pe-dusk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#fb7185" />
          </linearGradient>
          <pattern id="pe-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M5 0H0V5" fill="none" stroke={SKY} strokeOpacity="0.22" strokeWidth="0.4" />
          </pattern>
          <pattern id="pe-dots" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.55" fill="#7c2d12" fillOpacity="0.28" />
          </pattern>
          <pattern id="pe-ruled" width="40" height="4.5" patternUnits="userSpaceOnUse">
            <path d="M0 4.2H40" stroke="#7dd3fc" strokeOpacity="0.18" strokeWidth="0.4" />
          </pattern>
        </defs>
        {pages.map((p, i) => (
          <g key={p.label} className="fa-e-in" style={at(i * 0.3)}>
            <PageLabel x={p.x} y={14}>
              {p.label}
            </PageLabel>
            <Page x={p.x} y={17} w={40} h={57} fill={p.fill} className={p.className}>
              <rect x={p.x} y={17} width="40" height="57" rx="1.6" fill={p.pattern} />
              {/* The logo on it: a mark and the name under it, in the page's own ink. */}
              <circle cx={p.x + 20} cy={36} r="8" fill="none" stroke={p.accent} strokeWidth="2.6" />
              <circle cx={p.x + 20} cy={36} r="3" fill={p.accent} />
              <text
                x={p.x + 20}
                y={56}
                textAnchor="middle"
                fontSize="7"
                fontWeight="800"
                fontFamily={SERIF}
                className={p.inkClass}
                fill={p.ink}
              >
                Bloom
              </text>
              <rect
                x={p.x + 12}
                y={60}
                width="16"
                height="1.4"
                rx="0.7"
                fill={p.ink}
                fillOpacity="0.3"
                className={p.inkClass}
              />
            </Page>
          </g>
        ))}
        <g transform="translate(40 0)">
          {/* The theme's swatches, the page tint picked from them. */}
          <g className="fa-e-in" style={at(1.2)}>
            {[SKY, '#0284c7', VIOLET, AMBER, '#0f172a'].map((c, i) => (
              <circle
                key={c}
                cx={93 + i * 8.5}
                cy={84}
                r="2.6"
                fill={c}
                className={i === 4 ? 'dark:stroke-slate-500' : undefined}
                stroke={i === 0 ? '#ffffff' : 'none'}
                strokeWidth="0.8"
              />
            ))}
            <circle cx="93" cy="84" r="4" fill="none" stroke={SKY} strokeWidth="0.7" />
          </g>
        </g>
      </svg>
    </Frame>
  );
}
