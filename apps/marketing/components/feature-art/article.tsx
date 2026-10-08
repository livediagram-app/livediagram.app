// Feature art for writing on Illustrate's article pages (docs/specs/019-marketing/marketing-site.md,
// docs/specs/007-editor/article-pages.md): an article page with its toolbar, writing in progress
// and the / block menu open. Split out of ./infographics by subject; built on ./page-kit so the
// page reads as paper on the canvas in light and in dark.

import { Frame } from './shared';
import {
  AMBER,
  at,
  Cursor,
  EMERALD,
  INK,
  INK_SOFT,
  Lines,
  Page,
  Panel,
  SERIF,
  SKY,
  SKY_DEEP,
  VIOLET,
} from './page-kit';

/** Write like a doc: an article page with its toolbar, writing in progress and the / block menu open. */
export function ArticlePagesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <g transform="translate(22 -4)">
          {/* The page runs on below the card's edge, as a long read does. */}
          <Page x={50} y={10} w={98} h={96}>
            {/* The formatting toolbar, on the page. */}
            <rect
              className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
              x="56"
              y="15"
              width="66"
              height="9"
              rx="2.4"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="0.6"
            />
            <text x="60" y="21.2" fontSize="4" fontWeight="800" className={INK_SOFT} fill="#64748b">
              H1
            </text>
            <text x="69" y="21.2" fontSize="4.2" fontWeight="900" className={INK} fill="#1e293b">
              B
            </text>
            <text
              x="76"
              y="21.2"
              fontSize="4.2"
              fontStyle="italic"
              fontFamily={SERIF}
              className={INK}
              fill="#1e293b"
            >
              I
            </text>
            <text
              x="82"
              y="21.2"
              fontSize="4.2"
              textDecoration="underline"
              className={INK}
              fill="#1e293b"
            >
              U
            </text>
            <path
              d="M89 16.5v6"
              className="stroke-slate-200 dark:stroke-slate-700"
              stroke="#e2e8f0"
              strokeWidth="0.5"
            />
            <circle cx="94" cy="19.5" r="1.6" fill={SKY} />
            <path
              d="M99 18h6M99 21h4"
              className="stroke-slate-400"
              stroke="#94a3b8"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
            <path
              d="M110 18.2a1.8 1.8 0 0 1 3 0M110 20.8a1.8 1.8 0 0 0 3 0"
              fill="none"
              className="stroke-slate-400"
              stroke="#94a3b8"
              strokeWidth="0.7"
            />

            <text x="58" y="34" fontSize="3.4" fontWeight="700" letterSpacing="0.4" fill={SKY}>
              FIELD NOTES
            </text>
            <text
              x="58"
              y="43"
              fontSize="8"
              fontWeight="700"
              fontFamily={SERIF}
              className={INK}
              fill="#1e293b"
            >
              How we ship on Fridays
            </text>
            <Lines x={58} y={49} w={80} count={3} gap={4} height={1.5} />
            {/* The words a teammate commented on, marked. */}
            <rect
              x="57"
              y="51.9"
              width="44"
              height="3.6"
              rx="0.8"
              fill={AMBER}
              fillOpacity="0.32"
            />

            {/* The line being written: a slash, the caret after it. */}
            <text x="58" y="66" fontSize="5" className={INK} fill="#1e293b">
              /
            </text>
            <rect className="fa-e-blink" x="61" y="61.5" width="0.7" height="5.6" fill={SKY} />
          </Page>

          {/* The block menu, opened by the slash. */}
          <g className="fa-e-in" style={at(0.6)}>
            <Panel x={64} y={69} w={60} h={40}>
              {[
                ['Heading', 'H'],
                ['Image', '▢'],
                ['Table', '▦'],
              ].map(([label, glyph], i) => (
                <g key={label}>
                  {i === 1 ? (
                    <rect
                      className="fill-sky-50 dark:fill-sky-950"
                      x="66"
                      y={72 + i * 8.6}
                      width="56"
                      height="8"
                      rx="2"
                      fill="#f0f9ff"
                    />
                  ) : null}
                  <rect
                    className="fill-slate-100 dark:fill-slate-800"
                    x="69"
                    y={73.4 + i * 8.6}
                    width="5.2"
                    height="5.2"
                    rx="1.2"
                    fill="#f1f5f9"
                  />
                  <text
                    x="71.6"
                    y={77.4 + i * 8.6}
                    textAnchor="middle"
                    fontSize="3.6"
                    fontWeight="700"
                    fill={i === 1 ? SKY : '#64748b'}
                  >
                    {glyph}
                  </text>
                  <text
                    x="78"
                    y={77.6 + i * 8.6}
                    fontSize="4.4"
                    fontWeight={i === 1 ? 700 : 500}
                    className={i === 1 ? undefined : INK}
                    fill={i === 1 ? SKY_DEEP : '#1e293b'}
                  >
                    {label}
                  </text>
                </g>
              ))}
            </Panel>
          </g>

          {/* A teammate reading along. */}
          <g className="fa-e-in" style={at(1.2)}>
            <Cursor x={124} y={53} color={VIOLET} name="Sam" />
          </g>
        </g>
        {/* The comment in the margin, tied to its words. */}
        <g className="fa-e-in" style={at(1.6)}>
          <path d="M123 53.7H182" stroke={AMBER} strokeWidth="0.7" strokeDasharray="1.6 1.4" />
          <circle cx="123" cy="53.7" r="1.2" fill={AMBER} />
          <g transform="translate(-14 0)">
            <Panel x={196} y={38} w={88} h={32}>
              <circle cx="205" cy="47" r="4" fill={EMERALD} />
              <text
                x="205"
                y="48.5"
                textAnchor="middle"
                fontSize="3.4"
                fontWeight="700"
                fill="#ffffff"
              >
                AN
              </text>
              <text x="212" y="46" fontSize="4.2" fontWeight="700" className={INK} fill="#1e293b">
                Ana
              </text>
              <text x="225" y="46" fontSize="3.6" className={INK_SOFT} fill="#64748b">
                2m ago
              </text>
              <text x="212" y="54" fontSize="4.2" className={INK} fill="#1e293b">
                Add the demo numbers
              </text>
              <text x="212" y="60" fontSize="4.2" className={INK} fill="#1e293b">
                from last Friday?
              </text>
            </Panel>
          </g>
        </g>
      </svg>
    </Frame>
  );
}
