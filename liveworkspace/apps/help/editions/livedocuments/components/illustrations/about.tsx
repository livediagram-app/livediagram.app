// About and account scenes (liveworkspace/docs/specs/017-help/help-centre.md) in livedocuments' own content: the canvas
// with no sign-in gate, the public code behind the running app, guest work moving to a new account, and where a guest's
// and an account's documents live. Pages come from ./doc-page.

import { Arrow, Avatar, Label, Lift, Scene } from '@liveworkspace/help-site/art/primitives';
import { Mark } from './editor-chrome';
import { Page, Sheet, SlideContent } from './doc-page';

/** A white hairline card with its soft lift. */
function Plate({
  x,
  y,
  w,
  h,
  r = 8,
  stroke = 'stroke-slate-200',
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  stroke?: string;
}) {
  return (
    <g>
      <Lift x={x} y={y} w={w} h={h} r={r} />
      <rect x={x} y={y} width={w} height={h} rx={r} className={`fill-white ${stroke}`} strokeWidth={0.75} />
    </g>
  );
}

/** A slide in miniature, `w` wide at 16:9, as a document's thumbnail. */
function Thumb({ x, y, w, title, layout }: { x: number; y: number; w: number; title: string; layout?: 'title' | 'chart' | 'picture' }) {
  const h = Math.round((w * 9) / 16);
  return (
    <g>
      <Sheet x={x} y={y} w={w} h={h}>
        <g transform={`translate(${x} ${y}) scale(${w / 176}) translate(${-x} ${-y})`}>
          <SlideContent x={x} y={y} w={176} h={99} title={title} layout={layout} />
        </g>
      </Sheet>
    </g>
  );
}

/** Straight to work: a slide already being made on the canvas, and the sign-in gate that is not there, crossed out. */
export function OpenCanvas() {
  return (
    <Scene w={420} h={210}>
      <Page x={24} y={44} w={236} h={133} name="Cover">
        <SlideContent x={24} y={44} w={236} h={133} title="Launch Plan" layout="picture" />
      </Page>
      <Plate x={296} y={56} w={100} h={84} />
      <Label x={346} y={74} size={10} weight={650} tone="muted" anchor="middle">
        Sign In
      </Label>
      <rect x={310} y={86} width={72} height={14} rx={4} className="fill-slate-100" />
      <rect x={310} y={106} width={72} height={18} rx={4} className="fill-brand-200" />
      <line
        x1={302}
        y1={62}
        x2={390}
        y2={134}
        className="stroke-rose-500"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Label x={346} y={158} size={10} weight={650} tone="accent" anchor="middle">
        Not Required
      </Label>
    </Scene>
  );
}

/** Open source: the public code flowing into the running app at livedocuments.app, a deck open in it, under its MIT
 *  licence. */
export function OpenSource() {
  return (
    <Scene w={420} h={210} bg="plain">
      <g className="help-art-as-drawn">
        <rect x={28} y={36} width={176} height={130} rx={8} className="fill-slate-800" />
        <rect x={28} y={36} width={176} height={20} rx={8} className="fill-slate-700" />
        <rect x={28} y={48} width={176} height={8} className="fill-slate-700" />
        {['fill-rose-400', 'fill-amber-400', 'fill-emerald-400'].map((c, i) => (
          <circle key={c} cx={40 + i * 10} cy={46} r={2.5} className={c} />
        ))}
        {[
          ['fill-emerald-400', 48],
          ['fill-slate-400', 96],
          ['fill-amber-300', 72],
          ['fill-slate-400', 120],
          ['fill-emerald-400', 60],
          ['fill-slate-400', 104],
        ].map(([cls, w], i) => (
          <rect
            key={i}
            x={44 + (i % 2) * 10}
            y={68 + i * 15}
            width={w as number}
            height={5}
            rx={2.5}
            className={cls as string}
          />
        ))}
      </g>
      <Arrow from={[212, 101]} to={[256, 101]} tone="accent" />
      <Plate x={264} y={48} w={136} h={106} />
      <line x1={264} y1={68} x2={400} y2={68} className="stroke-slate-200" strokeWidth={0.75} />
      <Mark x={276} y={58} s={10} />
      <Label x={286} y={58.5} size={9} weight={600} tone="body">
        livedocuments.app
      </Label>
      <Thumb x={276} y={80} w={112} title="Pitch Deck" layout="title" />
      <Plate x={28} y={176} w={78} h={22} r={6} stroke="stroke-brand-300" />
      <Label x={67} y={187.5} size={9.5} weight={650} tone="accent" anchor="middle">
        MIT Licence
      </Label>
    </Scene>
  );
}

/** One side of the move: a labelled card holding a guest's or an account's documents. */
function Library({ x, title, sub, brand }: { x: number; title: string; sub: string; brand?: boolean }) {
  return (
    <g>
      <Plate x={x} y={50} w={148} h={124} stroke={brand ? 'stroke-brand-300' : 'stroke-slate-200'} />
      <Label x={x + 12} y={66} size={10} weight={650} tone={brand ? 'accent' : 'strong'}>
        {title}
      </Label>
      <Label x={x + 12} y={79} size={9} tone="muted">
        {sub}
      </Label>
      <Thumb x={x + 12} y={92} w={58} title="Deck" layout="title" />
      <Thumb x={x + 78} y={92} w={58} title="Q3" />
      <Thumb x={x + 12} y={132} w={58} title="Trip" layout="picture" />
    </g>
  );
}

/** Signing up: the documents you made as a guest, kept by this browser's id, move over to your new account. */
export function MigrateOnSignUp() {
  return (
    <Scene w={420} h={210} bg="plain">
      <Library x={26} title="As a Guest" sub="Kept by this browser's id" />
      <Arrow from={[182, 112]} to={[238, 112]} tone="accent" />
      <Label x={210} y={100} size={9.5} weight={600} tone="accent" anchor="middle">
        Moves Over
      </Label>
      <Library x={246} title="Your Account" sub="Yours on every device" brand />
    </Scene>
  );
}

/** Guest or account: a guest's documents live in one browser; an account's follow you to every device. */
export function GuestVsAccount() {
  return (
    <Scene w={420} h={230} bg="plain">
      <Plate x={20} y={20} w={180} h={190} />
      <Label x={110} y={42} size={11} weight={650} tone="strong" anchor="middle">
        Guest
      </Label>
      <Label x={110} y={56} size={9} tone="muted" anchor="middle">
        Saved in this browser
      </Label>
      <rect x={46} y={76} width={128} height={86} rx={5} className="fill-slate-50 stroke-slate-300" strokeWidth={0.75} />
      <Thumb x={56} y={88} w={50} title="Deck" layout="title" />
      <Thumb x={114} y={88} w={50} title="Q3" />
      <Thumb x={56} y={124} w={50} title="Trip" layout="picture" />
      <Label x={110} y={188} size={9} tone="muted" anchor="middle">
        One browser, one device
      </Label>

      <Plate x={220} y={20} w={180} h={190} stroke="stroke-brand-300" />
      <Label x={310} y={42} size={11} weight={650} tone="accent" anchor="middle">
        Account
      </Label>
      <Label x={310} y={56} size={9} tone="muted" anchor="middle">
        Synced across devices
      </Label>
      <rect x={236} y={76} width={100} height={66} rx={5} className="fill-slate-50 stroke-slate-300" strokeWidth={0.75} />
      <Thumb x={246} y={86} w={80} title="Pitch Deck" layout="title" />
      <rect x={344} y={84} width={44} height={58} rx={6} className="fill-slate-50 stroke-slate-300" strokeWidth={0.75} />
      <Thumb x={348} y={100} w={36} title="Deck" layout="title" />
      <Avatar cx={310} cy={176} r={10} initial="A" colour="brand" />
      <Label x={310} y={200} size={9} tone="muted" anchor="middle">
        Signed in everywhere
      </Label>
    </Scene>
  );
}
