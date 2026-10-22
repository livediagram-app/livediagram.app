// Explorer illustrations for the Library pages (docs/specs/018-help/help-app.md): the Themes page.
// Labels are lifted from the live editor's own copy (ThemesPane) so the figures match what a
// reader sees. Composed from the shared primitives.

import { Scene, Label } from './primitives';

// --- Scenes ------------------------------------------------------------------

/** The Themes page: a card per saved theme (swatch, name, Edit, Duplicate and Delete buttons) and
 *  the dashed New Theme card. */
export function SavedThemeCards() {
  const themes = [
    { name: 'Ocean', swatches: ['fill-brand-500', 'fill-brand-300', 'fill-brand-100'] },
    { name: 'Forest', swatches: ['fill-emerald-500', 'fill-emerald-400', 'fill-teal-400'] },
    { name: 'Sunset', swatches: ['fill-rose-500', 'fill-amber-500', 'fill-amber-400'] },
  ];
  return (
    <Scene w={420} h={176} bg="plain">
      <Label x={24} y={22} size={14} weight={700} tone="strong">
        Themes
      </Label>
      {themes.map((t, i) => {
        const tx = 20 + i * 96;
        return (
          <g key={t.name}>
            <rect
              x={tx}
              y={38}
              width={88}
              height={122}
              rx={10}
              className="fill-white stroke-slate-200"
              strokeWidth={1.5}
            />
            <g className="help-art-as-drawn">
              {t.swatches.map((s, j) => (
                <rect
                  key={j}
                  x={tx + 10 + j * 23}
                  y={48}
                  width={22}
                  height={40}
                  rx={j === 0 ? 4 : 0}
                  className={s}
                />
              ))}
            </g>
            <Label x={tx + 10} y={104} size={11} weight={600} tone="strong">
              {t.name}
            </Label>
            {/* Edit, Duplicate, Delete */}
            {[0, 1, 2].map((j) => (
              <g key={j}>
                <rect
                  x={tx + 10 + j * 24}
                  y={120}
                  width={20}
                  height={20}
                  rx={5}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1.2}
                />
                {j === 0 && (
                  <path
                    d={`M${tx + 15} ${135} l1 -3.5 l6 -6 l2.5 2.5 l-6 6 Z`}
                    fill="none"
                    className="stroke-slate-500"
                    strokeWidth={1.1}
                  />
                )}
                {j === 1 && (
                  <g fill="none" className="stroke-slate-500" strokeWidth={1.1}>
                    <rect x={tx + 39} y={126} width={7} height={8} rx={1} />
                    <path d={`M${tx + 42} ${126} v-2 h7 v8 h-3`} />
                  </g>
                )}
                {j === 2 && (
                  <path
                    d={`M${tx + 63} ${126} h10 M${tx + 65} ${126} v8 h6 v-8 M${tx + 66.5} ${124} h3`}
                    fill="none"
                    className="stroke-rose-500"
                    strokeWidth={1.1}
                    strokeLinecap="round"
                  />
                )}
              </g>
            ))}
          </g>
        );
      })}
      <rect
        x={308}
        y={38}
        width={92}
        height={122}
        rx={10}
        className="fill-none stroke-slate-300"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <path
        d="M354 86 v14 M347 93 h14"
        className="stroke-slate-400"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Label x={354} y={114} anchor="middle" size={10} weight={500} tone="muted">
        New Theme
      </Label>
    </Scene>
  );
}
