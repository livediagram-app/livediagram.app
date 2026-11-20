// The deck in Contents (docs/specs/007-editor/pages-mode.md "A page's place in the deck lives in Contents"): the
// sidebar's filmstrip of slides in the show's order, a slide hidden from the show under its veil, and one page's ⋯
// menu with its place in the show (Present From Here, Hide in Slides) after Page Settings. Composed from the shared
// primitives, with raw shapes for the filmstrip pictures.
import { Scene, Label, Menu, TextBar } from '@liveworkspace/help-site/art/primitives';

/** One filmstrip row: its number, a 16:9 picture, its name under it. */
function FilmRow({
  y,
  n,
  name,
  here = false,
  hidden = false,
}: {
  y: number;
  n: number;
  name: string;
  here?: boolean;
  hidden?: boolean;
}) {
  const px = 44;
  const pw = 112;
  const ph = 63;
  return (
    <g>
      {here ? (
        <rect x={20} y={y - 4} width={152} height={ph + 26} rx={8} className="fill-brand-50" />
      ) : null}
      <Label
        x={32}
        y={y + 8}
        size={10}
        weight={700}
        tone={here ? 'accent' : 'muted'}
        anchor="middle"
      >
        {String(n)}
      </Label>
      <rect
        x={px}
        y={y}
        width={pw}
        height={ph}
        rx={4}
        className={here ? 'fill-white stroke-brand-500' : 'fill-white stroke-slate-200'}
        strokeWidth={here ? 2 : 1.2}
        strokeDasharray={hidden ? '4 3' : undefined}
      />
      <TextBar x={px + 10} y={y + 14} w={60} h={7} tone={hidden ? 'faint' : 'accent'} />
      <TextBar x={px + 10} y={y + 28} w={80} h={4} tone="faint" />
      <TextBar x={px + 10} y={y + 37} w={70} h={4} tone="faint" />
      {hidden ? (
        <g>
          <rect x={px} y={y} width={pw} height={ph} rx={4} className="fill-slate-100/70" />
          <rect
            x={px + pw / 2 - 26}
            y={y + ph / 2 - 9}
            width={52}
            height={18}
            rx={9}
            className="fill-slate-800 help-art-as-drawn"
          />
          <Label
            x={px + pw / 2}
            y={y + ph / 2 + 1}
            size={9}
            weight={600}
            tone="onAccent"
            anchor="middle"
          >
            Hidden
          </Label>
        </g>
      ) : null}
      <Label x={px} y={y + ph + 12} size={10} weight={600} tone={hidden ? 'muted' : 'strong'}>
        {name}
      </Label>
    </g>
  );
}

/** Contents docked as the sidebar: three slides in the show's order, the third hidden, the second's ⋯ menu open. */
export function ContentsSlidesMenu() {
  return (
    <Scene w={420} h={300}>
      {/* The sidebar, flush to the canvas's left edge. */}
      <rect
        x={12}
        y={12}
        width={168}
        height={276}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <FilmRow y={24} n={1} name="Where We Are" />
      <FilmRow y={116} n={2} name="The Bottleneck" here />
      <FilmRow y={208} n={3} name="Old Numbers" hidden />
      {/* The second slide's ⋯, pressed. */}
      <rect x={24} y={142} width={16} height={16} rx={4} className="fill-brand-100" />
      <Label x={32} y={150} size={11} weight={700} tone="accent" anchor="middle">
        ⋯
      </Label>
      <Menu
        x={196}
        y={118}
        w={190}
        items={[
          'Page Settings',
          'Present From Here',
          'Hide in Slides',
          'Duplicate',
          'Lock',
          'Delete',
        ]}
        active={1}
      />
    </Scene>
  );
}
