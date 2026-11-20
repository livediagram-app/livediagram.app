// The Font and theme scenes of livehuddle's canvas basics (liveworkspace/docs/specs/017-help/help-centre.md): the
// element menu's Font tiles over a selected note, and the Text and Colours panels of the Tab Style dialog, whose
// preview in a Space is a small room (livehuddle's tab-style-profile.tsx, TabStylePreview). The dialog's frame and
// controls are every product's (help-site tab-style-parts); only the previews are a Space's.

import { Label, Menu, Scene, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import {
  Caption,
  CarouselHeading,
  OptionBox,
  PageDots,
  TabStylePanel,
} from '@liveworkspace/help-site/art/illustrations/tab-style-parts';
import { Plant, RoomSign, Sticky } from './space-furniture';

/** A selected note with its menu's Text flyout open on the Font tiles, one face chosen. */
export function ElementFontMenu() {
  const fonts = ['Inter', 'Poppins', 'Nunito', 'Oswald', 'Lora', 'Kalam'];
  return (
    <Scene w={420} h={210}>
      <Sticky x={26} y={70} w={96} h={80} label="Welcome!" lines={3} />
      <SelectionBox x={26} y={70} w={96} h={80} />
      <Menu x={142} y={34} w={108} items={['Style', 'Text']} active={1} rowH={24} />
      <Label x={238} y={75} anchor="end" size={11} weight={600} tone="accent">
        ›
      </Label>
      <rect
        x={260}
        y={34}
        width={146}
        height={150}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={272} y={52} size={11} weight={600} tone="strong">
        Font
      </Label>
      {fonts.map((f, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        return (
          <OptionBox key={f} x={270 + col * 66} y={64 + row * 32} w={60} h={26} on={i === 1}>
            <Label
              x={300 + col * 66}
              y={78 + row * 32}
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
      <line x1={260} y1={166} x2={406} y2={166} className="stroke-slate-100" strokeWidth={0.75} />
      <Label x={272} y={176} size={10} tone="body">
        Size
      </Label>
    </Scene>
  );
}

/** The Space preview at the top of the dialog's panels: a small room with its sign, a note and a plant, lettered
 *  in the tab's font. */
function RoomPreview() {
  return (
    <g>
      <g className="help-art-as-drawn">
        <rect
          x={60}
          y={86}
          width={300}
          height={44}
          rx={6}
          className="fill-amber-50 stroke-stone-300"
          strokeWidth={2}
        />
        <rect x={60} y={86} width={300} height={6} rx={3} className="fill-stone-300" />
      </g>
      <RoomSign x={78} y={100} name="Team Room" />
      <Sticky x={226} y={98} w={44} h={26} tone="emerald" label="Hi!" />
      <Plant cx={332} cy={110} s={0.9} />
    </g>
  );
}

/** The Text panel: the room preview, the typeface cards (a page of nine) and the four sizes of new text. */
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
      <RoomPreview />
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

/** One theme card in the Colours panel: two notes on the room's floor in the theme's colours, and its name. */
function ThemeTile({
  x,
  y,
  name,
  floor,
  notes,
  on = false,
}: {
  x: number;
  y: number;
  name: string;
  floor: string;
  notes: [string, string];
  on?: boolean;
}) {
  return (
    <OptionBox x={x} y={y} w={96} h={50} on={on} label={name}>
      <g className="help-art-as-drawn">
        <rect x={x + 6} y={y + 5} width={84} height={24} rx={4} className={floor} strokeWidth={1} />
        <rect x={x + 22} y={y + 9} width={22} height={16} className={notes[0]} />
        <rect x={x + 52} y={y + 9} width={22} height={16} className={notes[1]} />
      </g>
    </OptionBox>
  );
}

/** The Colours panel: every theme in one carousel, nine to a page, Default first. */
export function LookAndFeelTheme() {
  const themes: [string, string, [string, string]][] = [
    ['Default', 'fill-white stroke-slate-200', ['fill-amber-100', 'fill-emerald-100']],
    ['Pink', 'fill-rose-50 stroke-rose-100', ['fill-rose-200', 'fill-rose-300']],
    ['Forest', 'fill-emerald-50 stroke-emerald-100', ['fill-emerald-200', 'fill-emerald-400']],
    ['Sunset', 'fill-orange-50 stroke-orange-100', ['fill-orange-200', 'fill-amber-300']],
    ['Lavender', 'fill-violet-50 stroke-violet-100', ['fill-violet-200', 'fill-violet-300']],
    ['Mono', 'fill-white stroke-slate-200', ['fill-slate-200', 'fill-slate-300']],
    ['Ocean', 'fill-cyan-50 stroke-cyan-100', ['fill-cyan-200', 'fill-teal-300']],
    ['Sky', 'fill-sky-50 stroke-sky-100', ['fill-sky-200', 'fill-sky-300']],
    ['Midnight', 'fill-slate-800 stroke-slate-700', ['fill-indigo-400', 'fill-slate-600']],
  ];
  return (
    <TabStylePanel panel="Colours" h={284} sceneH={308}>
      <CarouselHeading y={98} label="THEMES" />
      {themes.map(([name, floor, notes], i) => (
        <ThemeTile
          key={name}
          x={60 + (i % 3) * 102}
          y={106 + Math.floor(i / 3) * 56}
          name={name}
          floor={floor}
          notes={notes}
          on={i === 0}
        />
      ))}
      <PageDots cx={210} y={280} count={3} />
    </TabStylePanel>
  );
}
