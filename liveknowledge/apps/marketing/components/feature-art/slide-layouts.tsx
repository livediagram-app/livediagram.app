// Feature art for the Documents & slides category's slide card (docs/specs/007-editor/pages-mode.md):
// a 16:9 slide page taking a layout from the picker. Split from ./documents; built on ./mode-parts like it.

import { at, BAR, Cursor, INK, MUTED, Pill, Stage, SURFACE, TextLines, YOU } from './mode-parts';
import { SKY as ACCENT } from '@liveworkspace/marketing-site/components/feature-art/shared';

/** A 16:9 slide page taking a layout from the picker, ready to add to the deck. */
export function SlideLayoutsArt() {
  const layouts = ['Title', 'Agenda', 'Two Columns', 'Image + Text'];
  const chosen = 3;
  return (
    <Stage>
      {/* The layouts. */}
      <rect className={SURFACE} x="8" y="6" width="74" height="86" rx="5" strokeWidth="0.8" />
      <text
        className={MUTED}
        x={14}
        y={15.5}
        fontSize="5.2"
        fontWeight="700"
        letterSpacing="0.4"
        fill="#64748b"
      >
        LAYOUTS
      </text>
      {layouts.map((label, i) => {
        const y = 20 + i * 17.5;
        const on = i === chosen;
        return (
          <g key={label}>
            {on ? (
              <rect
                className="fill-sky-50 stroke-sky-400 dark:fill-sky-500/15 dark:stroke-sky-400"
                x={11}
                y={y - 1.5}
                width="68"
                height="16"
                rx="3"
                fill="#f0f9ff"
                stroke="#38bdf8"
                strokeWidth="0.8"
              />
            ) : null}
            <rect
              className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-600"
              x={14}
              y={y}
              width="23"
              height="13"
              rx="1"
              fill="#fff"
              stroke="#e2e8f0"
              strokeWidth="0.6"
            />
            {i === 0 ? (
              <rect className={BAR} x={18} y={y + 5} width="15" height="2.4" rx="1" />
            ) : null}
            {i === 1 ? (
              <TextLines x={17} y={y + 3} w={17} widths={[0.6, 1, 1, 1]} gap={2.4} h={1} />
            ) : null}
            {i === 2 ? (
              <>
                <TextLines x={16.5} y={y + 3} w={8} widths={[1, 1, 1]} gap={2.6} h={1} />
                <TextLines x={26.5} y={y + 3} w={8} widths={[1, 1, 1]} gap={2.6} h={1} />
              </>
            ) : null}
            {i === 3 ? (
              <>
                <TextLines x={16.5} y={y + 3.5} w={9} widths={[1, 1, 0.7]} gap={2.6} h={1} />
                <rect x={27} y={y + 2.5} width="8" height="8" rx="0.8" fill="#7dd3fc" />
              </>
            ) : null}
            <text
              className={on ? 'fill-sky-700 dark:fill-sky-200' : MUTED}
              x={40.5}
              y={y + 8.6}
              fontSize="5.4"
              fontWeight={on ? 700 : 500}
              fill={on ? '#0369a1' : '#64748b'}
            >
              {label}
            </text>
          </g>
        );
      })}
      <g transform="translate(66 80)">
        <g className="fa-f-in" style={at(0)}>
          <Cursor colour={YOU} />
        </g>
      </g>

      {/* The slide: 16:9, the layout filled in. */}
      <text className={MUTED} x={94} y={11} fontSize="5" fontWeight="600" fill="#64748b">
        Page 3 · Slide · 16:9
      </text>
      <rect
        className={SURFACE}
        x={94}
        y={14}
        width="140"
        height="78.75"
        rx="1.5"
        strokeWidth="0.7"
      />
      <g className="fa-f-in" style={at(0.3)}>
        <rect x={94} y={14} width="3" height="78.75" fill={ACCENT} />
        <text
          className="fill-sky-600 dark:fill-sky-300"
          x={104}
          y={27}
          fontSize="4.8"
          fontWeight="800"
          letterSpacing="0.5"
          fill="#0284c7"
        >
          TRACTION
        </text>
        <text className={INK} x={104} y={38} fontSize="9" fontWeight="800" fill="#0f172a">
          3× faster
        </text>
        <text className={INK} x={104} y={47} fontSize="9" fontWeight="800" fill="#0f172a">
          launches
        </text>
        {[56, 63, 70].map((y) => (
          <g key={y}>
            <circle cx={105.5} cy={y + 1} r="1.2" fill={ACCENT} />
            <rect className={BAR} x={109} y={y} width="44" height="2" rx="1" />
          </g>
        ))}
      </g>
      <g className="fa-f-in" style={at(0.55)}>
        <defs>
          <linearGradient id="fa-f-slide-figure" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <rect x={168} y={24} width="56" height="58" rx="3" fill="url(#fa-f-slide-figure)" />
        {[14, 22, 30, 42].map((h, k) => (
          <rect
            key={k}
            x={176 + k * 11}
            y={74 - h}
            width="7"
            height={h}
            rx="1.5"
            fill="#fff"
            fillOpacity={k === 3 ? 1 : 0.55}
          />
        ))}
      </g>

      {/* Its size, and the deck it goes in. */}
      <rect className={SURFACE} x={240} y={14} width="50" height="13" rx="3.5" strokeWidth="0.7" />
      <rect
        className="fill-sky-100 dark:fill-sky-500/25"
        x={242}
        y={16}
        width="23"
        height="9"
        rx="2.5"
        fill="#e0f2fe"
      />
      <text
        className="fill-sky-700 dark:fill-sky-200"
        x={253.5}
        y={22.6}
        textAnchor="middle"
        fontSize="5.6"
        fontWeight="700"
        fill="#0369a1"
      >
        16:9
      </text>
      <text
        className={MUTED}
        x={277}
        y={22.6}
        textAnchor="middle"
        fontSize="5.6"
        fontWeight="500"
        fill="#64748b"
      >
        4:3
      </text>
      <rect x={240} y={78} width="50" height="14" rx="4" fill={ACCENT} />
      <text x={265} y={86.8} textAnchor="middle" fontSize="5.8" fontWeight="700" fill="#fff">
        + Add to deck
      </text>
      <g className="fa-f-in" style={at(1.2)}>
        <Pill x={240} y={34} text="In the deck" tone="emerald" w={50} />
      </g>
    </Stage>
  );
}
