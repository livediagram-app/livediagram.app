import { Label } from '@/components/illustrations/primitives';
import { Card, Stage } from './parts';

// Pages: a design as a row of pages. A phone wireframe in its device, a photo with a selection on it, and a
// square logo artboard with its construction circle, each labelled above its corner the way the editor labels them.
export function PagesArt() {
  return (
    <Stage>
      {/* A wireframe page: a phone screen inside its device. */}
      <Label x={24} y={34} size={8.5} weight={600} tone="muted">
        iPhone · Wireframe
      </Label>
      <rect x={38} y={42} width={78} height={146} rx={12} className="fill-slate-800" />
      <Card x={42} y={46} w={70} h={138} r={9}>
        <rect x={66} y={50} width={22} height={5} rx={2.5} className="fill-slate-800" />
        <rect x={50} y={64} width={36} height={6} rx={3} className="fill-brand-500" />
        <rect x={50} y={78} width={54} height={36} rx={3} className="fill-brand-50" />
        {[0, 1, 2].map((i) => (
          <rect
            key={`a${i}`}
            x={50}
            y={122 + i * 10}
            width={i === 2 ? 32 : 54}
            height={4}
            rx={2}
            className="fill-slate-200"
          />
        ))}
        <rect x={50} y={164} width={54} height={12} rx={6} className="fill-brand-500" />
      </Card>

      {/* A photo page: a landscape picture with a selection drawn on it. */}
      <Label x={146} y={62} size={8.5} weight={600} tone="muted">
        1920 x 1080 · Photo
      </Label>
      <Card x={146} y={70} w={136} h={77} r={4}>
        <rect x={146} y={70} width={136} height={77} rx={4} className="fill-sky-200" />
        <circle cx={256} cy={90} r={9} className="fill-amber-300" />
        <path d="M146 147 L186 106 L214 130 L238 114 L282 147 Z" className="fill-emerald-500" />
        <rect
          x={242}
          y={77}
          width={28}
          height={26}
          rx={2}
          className="fill-none stroke-slate-700"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      </Card>

      {/* A logo artboard: a square with its construction guide and a mark. */}
      <Label x={300} y={52} size={8.5} weight={600} tone="muted">
        1024 x 1024 · Logo
      </Label>
      <Card x={300} y={60} w={78} h={78} r={4}>
        <circle
          cx={339}
          cy={99}
          r={28}
          className="fill-none stroke-sky-300"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <path
          d="M339 60 V138 M300 99 H378"
          className="fill-none stroke-sky-200"
          strokeWidth={0.8}
        />
        <path d="M339 78 L358 112 H320 Z" className="fill-brand-500" />
        <circle cx={339} cy={101} r={7} className="fill-white" />
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
