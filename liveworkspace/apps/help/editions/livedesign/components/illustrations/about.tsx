// About scenes for livedesign (liveworkspace/docs/specs/017-help/help-centre.md): the public code and the app it
// builds, with a design's page in it rather than another app's work.

import { Arrow, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { Card, DesignPage } from './editor-chrome';
import { LogoMark } from './design-content';

/** The public, MIT-licensed code on the left, and the livedesign it builds on the right, a logo page open in it. */
export function OpenSource() {
  const lines: [string, number, number][] = [
    ['fill-emerald-400', 70, 48],
    ['fill-slate-400', 86, 96],
    ['fill-brand-300', 102, 72],
    ['fill-slate-400', 118, 120],
    ['fill-emerald-400', 134, 60],
    ['fill-slate-400', 150, 104],
  ];
  return (
    <Scene w={420} h={210} bg="plain">
      <g className="help-art-as-drawn">
        <rect x={32} y={36} width={176} height={138} rx={8} className="fill-slate-800" />
        <path d="M32 58 V44 a8 8 0 0 1 8 -8 H200 a8 8 0 0 1 8 8 V58 Z" className="fill-slate-700" />
        <circle cx={46} cy={47} r={3} className="fill-rose-400" />
        <circle cx={58} cy={47} r={3} className="fill-amber-400" />
        <circle cx={70} cy={47} r={3} className="fill-emerald-400" />
        {lines.map(([cls, y, w], i) => (
          <rect key={i} x={48 + (i % 2) * 10} y={y} width={w} height={6} rx={3} className={cls} />
        ))}
      </g>
      <Arrow from={[214, 105]} to={[262, 105]} width={1.5} />
      <Card x={268} y={46} w={130} h={118} r={8} />
      <path d="M268 64 V54 a8 8 0 0 1 8 -8 H390 a8 8 0 0 1 8 8 V64 Z" className="fill-slate-50" />
      <line x1={268} y1={64} x2={398} y2={64} className="stroke-slate-200" strokeWidth={0.75} />
      <Label x={333} y={55.5} anchor="middle" size={9} weight={600} tone="body">
        livedesign.app
      </Label>
      <DesignPage x={303} y={84} w={60} h={60} size="" bare>
        <LogoMark cx={333} cy={110} r={12} />
      </DesignPage>
      <rect
        x={32}
        y={180}
        width={72}
        height={20}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={68} y={190.5} anchor="middle" size={9.5} weight={600} tone="accent">
        MIT licence
      </Label>
    </Scene>
  );
}
