import { Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

// Pages: a document as a row of pages. An article page of flowing text, a slide with its title and a chart, and a
// square infographic with a big number, each labelled above its corner the way the editor labels them.
export function PagesArt() {
  return (
    <Stage>
      {/* An article page: a heading, then text flowing down the page. */}
      <Label x={24} y={34} size={8.5} weight={600} tone="muted">
        A4 · Article
      </Label>
      <Card x={24} y={42} w={104} h={146} r={4}>
        <rect x={36} y={56} width={58} height={7} rx={3} className="fill-brand-500" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={`a${i}`}
            x={36}
            y={74 + i * 10}
            width={i === 4 ? 52 : 80}
            height={4}
            rx={2}
            className="fill-slate-200"
          />
        ))}
        <rect
          x={36}
          y={128}
          width={80}
          height={30}
          rx={3}
          className="fill-brand-50 stroke-brand-200"
          strokeWidth={1}
        />
        {[0, 1].map((i) => (
          <rect
            key={`b${i}`}
            x={36}
            y={166 + i * 10}
            width={i === 1 ? 40 : 80}
            height={4}
            rx={2}
            className="fill-slate-200"
          />
        ))}
      </Card>

      {/* A slide: a title and a bar chart. */}
      <Label x={146} y={62} size={8.5} weight={600} tone="muted">
        Slide (16:9) · Slide
      </Label>
      <Card x={146} y={70} w={136} h={77} r={4}>
        <rect x={158} y={82} width={64} height={7} rx={3} className="fill-slate-700" />
        <rect x={158} y={95} width={40} height={4} rx={2} className="fill-slate-300" />
        {[22, 34, 16, 40].map((h, i) => (
          <rect
            key={`c${i}`}
            x={214 + i * 14}
            y={136 - h}
            width={9}
            height={h}
            rx={1.5}
            className={i === 3 ? 'fill-brand-500' : 'fill-brand-200'}
          />
        ))}
        <path d="M158 137 H274" className="fill-none stroke-slate-300" strokeWidth={1} />
      </Card>

      {/* A square infographic: a big number over a caption. */}
      <Label x={300} y={52} size={8.5} weight={600} tone="muted">
        Square
      </Label>
      <Card x={300} y={60} w={78} h={78} r={4}>
        <rect x={312} y={72} width={40} height={6} rx={3} className="fill-slate-700" />
        <rect x={312} y={88} width={54} height={20} rx={3} className="fill-brand-500" />
        <rect x={312} y={116} width={46} height={4} rx={2} className="fill-slate-200" />
        <rect x={312} y={124} width={30} height={4} rx={2} className="fill-slate-200" />
      </Card>

      {/* The add-page buttons after the last page. */}
      <circle cx={318} cy={168} r={11} className="fill-white stroke-slate-300" strokeWidth={1.3} />
      <path
        d="M318 162.5 V173.5 M312.5 168 H323.5"
        className="stroke-slate-500"
        strokeWidth={1.6}
      />
      <circle cx={346} cy={168} r={11} className="fill-white stroke-slate-300" strokeWidth={1.3} />
      <rect
        x={340.5}
        y={162.5}
        width={11}
        height={11}
        rx={2}
        className="fill-none stroke-slate-500"
        strokeWidth={1.4}
      />
    </Stage>
  );
}
