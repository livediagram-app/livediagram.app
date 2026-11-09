// The Font and theme scenes of every product's canvas basics (docs/specs/018-help/help-app.md): the element
// menu's Font tiles, and the Text and Colours panels of the Tab Style dialog (TypographySections.tsx,
// ThemeBrowser.tsx, TextTab.tsx). Composed from the shared primitives.

import { Label, Menu, Scene, SelectionBox, Shape } from '../primitives';
import { Caption, CarouselHeading, OptionBox, PageDots, TabStylePanel } from './tab-style-parts';

// --- Fonts -------------------------------------------------------------------------------------

/** A selected shape with its menu's Text flyout open on the Font tiles, one face chosen. */
export function ElementFontMenu() {
  const fonts = ['Inter', 'Poppins', 'Nunito', 'Oswald', 'Lora', 'Kalam'];
  return (
    <Scene w={420} h={230}>
      <Shape x={22} y={92} w={104} h={52} label="Step one" />
      <SelectionBox x={22} y={92} w={104} h={52} />
      <Menu x={142} y={40} w={108} items={['Style', 'Text']} active={1} rowH={24} />
      <Label x={238} y={81} anchor="end" size={11} weight={600} tone="accent">
        ›
      </Label>
      <rect
        x={260}
        y={40}
        width={146}
        height={150}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={272} y={58} size={11} weight={600} tone="strong">
        Font
      </Label>
      {fonts.map((f, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        return (
          <OptionBox key={f} x={270 + col * 66} y={70 + row * 32} w={60} h={26} on={i === 1}>
            <Label
              x={300 + col * 66}
              y={84 + row * 32}
              anchor="middle"
              size={10}
              weight={i === 1 ? 700 : 500}
              tone={i === 1 ? 'accent' : 'body'}
            >
              {f}
            </Label>
          </OptionBox>
        );
      })}
      <line x1={260} y1={172} x2={406} y2={172} className="stroke-slate-100" strokeWidth={1.5} />
      <Label x={272} y={182} size={10} tone="body">
        Size
      </Label>
    </Scene>
  );
}

/** The Text panel: a preview, the typeface cards (a page of nine) and the four sizes of new
 *  text. Picking either applies to the whole tab, so there is no Apply button. */
export function LookAndFeelFont() {
  const faces: [string, string][] = [
    ['Editor default', 'System'],
    ['Inter', 'Sans-serif'],
    ['Poppins', 'Geometric'],
    ['Nunito', 'Rounded'],
    ['Oswald', 'Condensed'],
    ['Space Grotesk', 'Techy sans'],
    ['Lora', 'Serif'],
    ['Bodoni Moda', 'Display serif'],
    ['Roboto Slab', 'Slab serif'],
  ];
  const sizes: [string, number | null][] = [
    ['Small', 9],
    ['Medium', 12],
    ['Large', 15],
    ['Scale', null],
  ];
  return (
    <TabStylePanel panel="Text" h={336} sceneH={360}>
      {/* Preview: a small sample diagram lettered in the tab's font. */}
      <g className="help-art-as-drawn">
        <rect
          x={60}
          y={92}
          width={300}
          height={36}
          rx={6}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <rect
          x={130}
          y={100}
          width={56}
          height={20}
          rx={4}
          className="fill-brand-100 stroke-brand-500"
          strokeWidth={1.3}
        />
        <rect
          x={234}
          y={100}
          width={56}
          height={20}
          rx={4}
          className="fill-brand-100 stroke-brand-500"
          strokeWidth={1.3}
        />
        <path d="M186 110 H232" className="stroke-brand-500" strokeWidth={1.3} />
        <path
          d="M227 106.5 L232 110 L227 113.5"
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.3}
        />
      </g>
      <Label x={158} y={110} anchor="middle" size={9} weight={600} tone="strong">
        Idea
      </Label>
      <Label x={262} y={110} anchor="middle" size={9} weight={600} tone="strong">
        Plan
      </Label>
      <CarouselHeading y={144} label="TYPEFACE" />
      {faces.map(([name, kind], i) => {
        const x = 60 + (i % 3) * 102;
        const y = 152 + Math.floor(i / 3) * 38;
        const on = i === 1;
        return (
          <g key={name}>
            <OptionBox x={x} y={y} w={96} h={34} on={on} />
            <Label x={x + 7} y={y + 17} size={13} weight={600} tone={on ? 'accent' : 'strong'}>
              Aa
            </Label>
            <Label x={x + 29} y={y + 12} size={8.5} weight={600} tone={on ? 'accent' : 'strong'}>
              {name}
            </Label>
            <Label x={x + 29} y={y + 24} size={8} tone="muted">
              {kind}
            </Label>
          </g>
        );
      })}
      <PageDots cx={210} y={272} count={2} />
      <Caption x={60} y={288}>
        SIZE OF NEW TEXT
      </Caption>
      {sizes.map(([name, px], i) => {
        const x = 60 + i * 77;
        const on = i === 0;
        return (
          <g key={name}>
            <OptionBox x={x} y={296} w={69} h={38} on={on} label={name} />
            {px ? (
              <Label
                x={x + 34.5}
                y={311}
                anchor="middle"
                size={px}
                weight={700}
                tone={on ? 'accent' : 'body'}
              >
                A
              </Label>
            ) : (
              <path
                d={`M${x + 29} 316 L${x + 40} 305 M${x + 35} 305 H${x + 40} V310 M${x + 29} 311 V316 H${x + 34}`}
                fill="none"
                className="stroke-slate-500"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        );
      })}
    </TabStylePanel>
  );
}

// --- Themes ------------------------------------------------------------------------------------

/** One theme card in the Colours panel: a tiny diagram in the theme's colours and its name. */
function ThemeTile({
  x,
  y,
  name,
  bg,
  node,
  line,
  on = false,
}: {
  x: number;
  y: number;
  name: string;
  bg: string;
  node: string;
  line: string;
  on?: boolean;
}) {
  return (
    <OptionBox x={x} y={y} w={96} h={50} on={on} label={name}>
      <g className="help-art-as-drawn">
        <rect x={x + 6} y={y + 5} width={84} height={24} rx={4} className={bg} strokeWidth={1} />
        <rect
          x={x + 14}
          y={y + 11}
          width={22}
          height={12}
          rx={3}
          className={node}
          strokeWidth={1.2}
        />
        <rect
          x={x + 60}
          y={y + 11}
          width={22}
          height={12}
          rx={3}
          className={node}
          strokeWidth={1.2}
        />
        <path d={`M${x + 36} ${y + 17} H${x + 60}`} className={line} strokeWidth={1.2} />
      </g>
    </OptionBox>
  );
}

/** The Colours panel: every theme in one carousel, nine to a page, Default first, then the
 *  catalogue. */
export function LookAndFeelTheme() {
  const themes: [string, string, string, string][] = [
    [
      'Default',
      'fill-white stroke-slate-200',
      'fill-brand-100 stroke-brand-500',
      'stroke-brand-500',
    ],
    ['Pink', 'fill-rose-50 stroke-rose-100', 'fill-rose-200 stroke-rose-500', 'stroke-rose-500'],
    [
      'Forest',
      'fill-emerald-50 stroke-emerald-100',
      'fill-emerald-200 stroke-emerald-700',
      'stroke-emerald-700',
    ],
    [
      'Sunset',
      'fill-orange-50 stroke-orange-100',
      'fill-orange-200 stroke-orange-500',
      'stroke-orange-500',
    ],
    [
      'Lavender',
      'fill-violet-50 stroke-violet-100',
      'fill-violet-200 stroke-violet-500',
      'stroke-violet-500',
    ],
    ['Mono', 'fill-white stroke-slate-200', 'fill-slate-100 stroke-slate-700', 'stroke-slate-700'],
    ['Ocean', 'fill-cyan-50 stroke-cyan-100', 'fill-cyan-200 stroke-cyan-700', 'stroke-cyan-700'],
    ['Sky', 'fill-sky-50 stroke-sky-100', 'fill-sky-200 stroke-sky-600', 'stroke-sky-600'],
    [
      'Midnight',
      'fill-slate-800 stroke-slate-700',
      'fill-slate-700 stroke-indigo-300',
      'stroke-indigo-300',
    ],
  ];
  return (
    <TabStylePanel panel="Colours" h={284} sceneH={308}>
      <CarouselHeading y={98} label="THEMES" />
      {themes.map(([name, bg, node, line], i) => (
        <ThemeTile
          key={name}
          x={60 + (i % 3) * 102}
          y={106 + Math.floor(i / 3) * 56}
          name={name}
          bg={bg}
          node={node}
          line={line}
          on={i === 0}
        />
      ))}
      <PageDots cx={210} y={280} count={3} />
    </TabStylePanel>
  );
}
