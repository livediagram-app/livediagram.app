// Collaboration scenes in livedesign's own work (liveworkspace/docs/specs/017-help/help-centre.md): live cursors
// over a design's pages, a teammate's selection, following someone, a one-tab share, an embedded design and an
// agent's change toast. Built from the chrome kit (./editor-chrome) and the page content (./design-content).

import {
  Avatar,
  Cursor,
  Label,
  Scene,
  SelectionBox,
  TextBar,
} from '@liveworkspace/help-site/art/primitives';
import { BottomBar, Card, DesignPage, HAIR, textW } from './editor-chrome';
import { BrowserScreen, LogoMark, PhoneScreen } from './design-content';

/** Two pages of a design with three people's cursors on them, and their initials on the open tab. */
export function LiveCursors() {
  return (
    <Scene w={420} h={236}>
      <DesignPage x={44} y={38} w={110} h={150} size="iPhone · Wireframe" bare>
        <PhoneScreen x={58} y={50} w={82} h={128} variant="home" frame={false} cta="Shop Now" />
      </DesignPage>
      <DesignPage x={196} y={38} w={150} h={150} size="Logo · Square" bare>
        <LogoMark cx={271} cy={104} r={26} />
      </DesignPage>
      <Cursor x={132} y={96} name="Aria" colour="rose" />
      <Cursor x={312} y={70} name="Jae" colour="violet" />
      <Cursor x={238} y={150} name="Mara" colour="emerald" />
      <BottomBar
        y={212}
        w={420}
        tabs={['Brand', 'App Screens']}
        presence={[
          { initial: 'A', colour: 'rose' },
          { initial: 'J', colour: 'violet' },
          { initial: 'M', colour: 'emerald' },
        ]}
      />
    </Scene>
  );
}

/** A teammate's selection on a page: their outline and initials badge on the button they are editing. */
export function PresenceSelection() {
  return (
    <Scene w={420} h={210}>
      <DesignPage x={140} y={36} w={140} h={160} size="iPhone · Wireframe" bare>
        <PhoneScreen x={152} y={46} w={116} h={144} variant="signin" cta="Sign In" frame={false} />
      </DesignPage>
      <rect
        x={155}
        y={163}
        width={110}
        height={18}
        rx={3}
        fill="none"
        className="stroke-violet-500"
        strokeWidth={1.5}
        strokeDasharray="4 2"
      />
      <Avatar cx={155} cy={163} r={7} initial="J" colour="violet" />
      <Cursor x={250} y={176} name="Jae" colour="violet" />
    </Scene>
  );
}

/** Following Sam: the pill at the top of the canvas with Stop, Sam's cursor on the page, and Sam's initials ringed
 *  on the open tab. */
export function FollowingScene() {
  return (
    <Scene w={420} h={226}>
      <rect
        x={136}
        y={10}
        width={148}
        height={20}
        rx={10}
        className="fill-emerald-500 dark:fill-emerald-700"
      />
      <circle cx={148} cy={20} r={2.5} className="fill-white help-art-as-drawn" />
      <Label x={156} y={20.5} size={9} weight={600} tone="onAccent">
        Following Sam
      </Label>
      <rect
        x={244}
        y={13}
        width={34}
        height={14}
        rx={7}
        className="fill-white/25 help-art-as-drawn"
      />
      <Label x={261} y={20.5} size={9} weight={600} anchor="middle" tone="onAccent">
        Stop
      </Label>
      <DesignPage x={92} y={60} w={236} h={128} size="Desktop · Wireframe" bare>
        <BrowserScreen x={102} y={68} w={216} h={112} />
      </DesignPage>
      <Cursor x={146} y={124} name="Sam" colour="emerald" />
      <BottomBar
        y={202}
        w={420}
        tabs={['Landing Page', 'Pricing']}
        presence={[{ initial: 'S', colour: 'emerald' }]}
      />
      <circle
        cx={Math.round(8 + textW('Landing Page') + 18)}
        cy={216.5}
        r={7}
        fill="none"
        className="stroke-emerald-500"
        strokeWidth={1.25}
      />
    </Scene>
  );
}

/** A visitor on a one-tab link: the shared tab's pages, and the other tabs shown as Not shared. */
export function OneTabShare() {
  return (
    <Scene w={420} h={216}>
      <DesignPage x={70} y={34} w={120} h={140} size="Logo · Square" bare>
        <LogoMark cx={130} cy={96} r={24} />
      </DesignPage>
      <DesignPage x={226} y={34} w={120} h={140} size="Logo · Square" bare>
        <rect x={226} y={34} width={120} height={140} className="fill-slate-800" />
        <circle cx={286} cy={96} r={24} className="fill-none stroke-brand-400" strokeWidth={4} />
        <circle cx={286} cy={96} r={5} className="fill-brand-400" />
      </DesignPage>
      <rect x={0} y={192} width={420} height={24} className="fill-slate-100" />
      <line x1={0} y1={192} x2={420} y2={192} className="stroke-slate-200" strokeWidth={HAIR} />
      <Label x={60} y={206.5} size={9} tone="muted" anchor="middle">
        Not shared
      </Label>
      <path
        d="M150 216 V201 a5 5 0 0 1 5 -5 H265 a5 5 0 0 1 5 5 V216"
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
      />
      <Label x={210} y={206.5} size={9} weight={600} anchor="middle" className="fill-brand-600">
        Brand Marks
      </Label>
      <Label x={360} y={206.5} size={9} tone="muted" anchor="middle">
        Not shared
      </Label>
    </Scene>
  );
}

/** A design embedded in a host page, its pages and the bar under them, beside the iframe snippet. */
export function EmbeddedWork() {
  return (
    <Scene w={420} h={220} bg="plain">
      <Card x={16} y={16} w={388} h={190} r={8} />
      <TextBar x={32} y={30} w={90} h={6} tone="muted" />
      <TextBar x={32} y={42} w={350} h={4} tone="faint" />
      <rect
        x={32}
        y={56}
        width={236}
        height={132}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={HAIR}
      />
      <DesignPage x={50} y={70} w={70} h={86} size="" bare>
        <PhoneScreen x={56} y={74} w={58} h={78} variant="home" frame={false} cta="Shop" />
      </DesignPage>
      <DesignPage x={130} y={70} w={70} h={86} size="" bare>
        <PhoneScreen x={136} y={74} w={58} h={78} variant="product" frame={false} cta="Add" />
      </DesignPage>
      <DesignPage x={210} y={70} w={44} h={86} size="" bare>
        <TextBar x={216} y={80} w={26} h={3} tone="muted" />
      </DesignPage>
      <rect
        x={40}
        y={164}
        width={92}
        height={16}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
      />
      <Label x={86} y={172.5} size={8.5} weight={600} anchor="middle" tone="body">
        Open in livedesign
      </Label>
      <g className="help-art-as-drawn">
        <rect x={280} y={56} width={110} height={132} rx={6} className="fill-slate-800" />
        {[
          ['<iframe', 'fill-emerald-400'],
          ['  src=".../embed"', 'fill-slate-300'],
          ['  width="800"', 'fill-slate-300'],
          ['  height="500"', 'fill-slate-300'],
          ['></iframe>', 'fill-emerald-400'],
        ].map(([t, c], i) => (
          <text
            key={i}
            x={290}
            y={78 + i * 16}
            fontSize={9}
            className={c}
            style={{ fontFamily: 'ui-monospace, monospace' }}
            xmlSpace="preserve"
          >
            {t}
          </text>
        ))}
      </g>
    </Scene>
  );
}

/** An agent's change on a page: the changed button outlined, and the toast naming who changed what, with Show and
 *  Undo. */
export function AgentChangeToast() {
  return (
    <Scene w={420} h={226}>
      <DesignPage x={150} y={30} w={120} h={130} size="iPhone · Wireframe" bare>
        <PhoneScreen
          x={160}
          y={38}
          w={100}
          h={116}
          variant="product"
          cta="Add to Cart"
          frame={false}
        />
      </DesignPage>
      <rect
        x={163}
        y={128}
        width={94}
        height={18}
        rx={4}
        fill="none"
        className="stroke-violet-500"
        strokeWidth={1.5}
      />
      <Card x={72} y={172} w={276} h={44} r={8} />
      <circle cx={88} cy={186} r={5} fill="none" className="stroke-slate-500" strokeWidth={0.9} />
      <path
        d="M88 184 v2.5 M88 188.5 v0.2"
        className="stroke-slate-500"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Label x={99} y={186.5} size={9} tone="body">
        Claude changed 2 elements: add a cart button
      </Label>
      <path
        d="M334 182 l6 6 M340 182 l-6 6"
        className="stroke-slate-400"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <rect
        x={96}
        y={196}
        width={36}
        height={14}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
      />
      <Label x={114} y={203.5} size={8.5} weight={500} anchor="middle" tone="body">
        Show
      </Label>
      <rect x={138} y={196} width={36} height={14} rx={4} className="fill-brand-600" />
      <Label x={156} y={203.5} size={8.5} weight={600} anchor="middle" tone="onAccent">
        Undo
      </Label>
    </Scene>
  );
}

/** The canvas open with no sign-in in front of it: a page ready to work on, and the sign-in step struck through. */
export function OpenCanvas() {
  return (
    <Scene w={420} h={210}>
      <DesignPage x={60} y={34} w={150} h={150} size="Logo · Square">
        <LogoMark cx={135} cy={100} r={28} />
      </DesignPage>
      <SelectionBox x={107} y={72} w={56} h={56} />
      <Card x={262} y={60} w={108} h={74} r={8} />
      <Label x={316} y={76} size={9} weight={600} anchor="middle" tone="muted">
        Sign in
      </Label>
      <rect x={276} y={88} width={80} height={9} rx={2} className="fill-slate-100" />
      <rect x={276} y={103} width={80} height={11} rx={3} className="fill-brand-100" />
      <path
        d="M266 64 L366 130"
        className="stroke-brand-500"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Label x={316} y={152} size={10} weight={600} anchor="middle" tone="accent">
        Not required
      </Label>
    </Scene>
  );
}
