// Working together in a document (liveworkspace/docs/specs/017-help/help-centre.md), on livedocuments' own canvas:
// live cursors and the presence stack on the tab, a teammate's selection and the hold it keeps, following someone,
// what a one-tab link shows, a document embedded in another page, and an agent's change toast. Drawn with the editor
// chrome kit (./editor-chrome) and the page kit (./doc-page).

import { lucideInfo, lucideX } from '@liveworkspace/icons/lucide';
import { Avatar, Cursor, Label, Lift, Scene } from '@liveworkspace/help-site/art/primitives';
import { BAR_H, BottomBar, Card, Icon } from './editor-chrome';
import { BarChart, Heading, Lines, Page, Pointer, Rule, Sheet, SlideContent } from './doc-page';

type Who = { initial: string; colour: 'brand' | 'emerald' | 'violet' | 'rose' };

/** The open tab on the bottom bar wearing its presence stack: who else is on it, as small overlapping avatars. */
function TabWithPresence({ y, people, ring }: { y: number; people: Who[]; ring?: string }) {
  const x0 = 8 + 74;
  return (
    <g>
      {people.map((p, i) => (
        <g key={p.initial}>
          {ring === p.initial && (
            <circle
              cx={x0 + i * 9}
              cy={y + 15}
              r={7.5}
              className="fill-none stroke-brand-500"
              strokeWidth={1.25}
            />
          )}
          <Avatar cx={x0 + i * 9} cy={y + 15} r={5.5} initial={p.initial} colour={p.colour} />
        </g>
      ))}
    </g>
  );
}

const TEAM: Who[] = [
  { initial: 'A', colour: 'emerald' },
  { initial: 'J', colour: 'violet' },
  { initial: 'M', colour: 'rose' },
];

/** Live presence in a document: Aria's and Jae's cursors on the slides, Mara's selection on the chart, and the
 *  three of them stacked on the open tab. */
export function DocumentPresence() {
  const W = 420;
  const H = 210;
  return (
    <Scene w={W} h={H}>
      <Page x={24} y={34} w={176} h={99} name="Cover" bar={{ look: false }}>
        <SlideContent x={24} y={34} w={176} h={99} title="Launch Plan" layout="title" />
      </Page>
      <Page x={220} y={34} w={176} h={99} name="Results" bar={{ look: false }}>
        <SlideContent x={220} y={34} w={176} h={99} title="Q3 Results" />
      </Page>
      <rect
        x={310}
        y={49}
        width={80}
        height={74}
        rx={1.5}
        className="fill-none stroke-rose-500"
        strokeWidth={1.25}
      />
      <Avatar cx={310} cy={49} r={6} initial="M" colour="rose" />
      <Cursor x={120} y={82} name="Aria" colour="emerald" />
      <Cursor x={262} y={140} name="Jae" colour="violet" />
      <BottomBar y={H - BAR_H} w={W} tabs={['Pitch Deck', 'Brief']} firstTabW={120} />
      <TabWithPresence y={H - BAR_H} people={TEAM} />
    </Scene>
  );
}

/** A teammate's selection: Jae's outline in Jae's colour round the chart, badged with their initial, while you look
 *  at the same slide. */
export function PresenceSelection() {
  return (
    <Scene w={420} h={190}>
      <Page x={60} y={36} w={300} h={140} name="Results">
        <Heading x={80} y={60} size={12}>
          Q3 Results
        </Heading>
        <Rule x={80} y={70} />
        <Lines x={80} y={84} w={100} n={4} gap={7} />
        <BarChart x={216} y={56} w={120} h={98} />
      </Page>
      <rect
        x={210}
        y={50}
        width={132}
        height={110}
        rx={2}
        className="fill-none stroke-violet-500"
        strokeWidth={1.5}
        strokeDasharray="4 2.5"
      />
      <Avatar cx={210} cy={50} r={7} initial="J" colour="violet" />
      <Cursor x={300} y={140} name="Jae" colour="violet" />
    </Scene>
  );
}

/** Releasing a hold: right-clicking the chart Jae is holding opens the In Use menu with Release Jae's Hold. */
export function ReleaseHold() {
  const mx = 236;
  const my = 54;
  return (
    <Scene w={420} h={200}>
      <Page x={24} y={36} w={196} h={148} name="Results" bar={{ look: false }}>
        <Heading x={40} y={58} size={11}>
          Q3 Results
        </Heading>
        <BarChart x={60} y={76} w={120} h={88} />
      </Page>
      <rect
        x={54}
        y={70}
        width={132}
        height={100}
        rx={2}
        className="fill-none stroke-violet-500"
        strokeWidth={1.5}
        strokeDasharray="4 2.5"
      />
      <Avatar cx={54} cy={70} r={7} initial="J" colour="violet" />
      <Pointer x={176} y={120} />
      <Lift x={mx} y={my} w={164} h={84} r={7} />
      <rect
        x={mx}
        y={my}
        width={164}
        height={84}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={mx + 12} y={my + 14} size={9} weight={600} tone="muted">
        In Use
      </Label>
      <rect x={mx + 5} y={my + 23} width={154} height={20} rx={4} className="fill-brand-50" />
      <circle cx={mx + 16} cy={my + 33} r={3.5} className="fill-violet-500" />
      <Label x={mx + 26} y={my + 33.5} size={9.5} weight={600} tone="accent">
        Release Jae&apos;s Hold
      </Label>
      <Label x={mx + 12} y={my + 58} size={9} tone="muted">
        They keep their work; it just
      </Label>
      <Label x={mx + 12} y={my + 70} size={9} tone="muted">
        stops being theirs to edit.
      </Label>
    </Scene>
  );
}

/** Following Sam: the pill at the top of the canvas with its Stop, Sam's cursor on the slide you are both looking at,
 *  and Sam's avatar ringed in the tab's presence stack. */
export function FollowAlong() {
  const W = 420;
  const H = 210;
  return (
    <Scene w={W} h={H}>
      <rect x={136} y={10} width={148} height={20} rx={10} className="fill-brand-600" />
      <circle cx={148} cy={20} r={3} className="fill-white help-art-as-drawn" />
      <Label x={157} y={20.5} size={9.5} weight={600} tone="onAccent">
        Following Sam
      </Label>
      <rect x={244} y={13} width={34} height={14} rx={7} className="fill-white/25" />
      <Label x={261} y={20.5} size={9} weight={700} tone="onAccent" anchor="middle">
        Stop
      </Label>
      <Page x={92} y={56} w={236} h={110} name="Results" bar={{ look: false }}>
        <SlideContent x={92} y={56} w={236} h={110} title="Q3 Results" />
      </Page>
      <Cursor x={276} y={110} name="Sam" colour="emerald" />
      <BottomBar y={H - BAR_H} w={W} tabs={['Pitch Deck', 'Brief']} firstTabW={112} />
      <TabWithPresence
        y={H - BAR_H}
        people={[
          { initial: 'S', colour: 'emerald' },
          { initial: 'J', colour: 'violet' },
        ]}
        ring="S"
      />
    </Scene>
  );
}

/** A visitor on a one-tab link: the shared Pitch Deck tab open, and the document's other tabs shown as Not Shared. */
export function OneTabShare() {
  const W = 420;
  const H = 180;
  const y = H - BAR_H;
  return (
    <Scene w={W} h={H}>
      <Page x={110} y={30} w={200} h={112} bare>
        <SlideContent x={110} y={30} w={200} h={112} title="Pitch Deck" layout="title" />
      </Page>
      <rect x={0} y={y} width={W} height={BAR_H} className="fill-slate-100" />
      <line x1={0} y1={y} x2={W} y2={y} className="stroke-slate-200" strokeWidth={0.75} />
      <Label x={60} y={y + 15.5} size={9} tone="muted" anchor="middle">
        Not Shared
      </Label>
      <path
        d={`M150 ${y + BAR_H} V${y + 9} a5 5 0 0 1 5 -5 H${265} a5 5 0 0 1 5 5 V${y + BAR_H}`}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={210} y={y + 15.5} size={9} weight={600} className="fill-brand-700" anchor="middle">
        Pitch Deck
      </Label>
      <Label x={360} y={y + 15.5} size={9} tone="muted" anchor="middle">
        Not Shared
      </Label>
    </Scene>
  );
}

/** A document embedded in another page: the host page's text around the embed, which shows the slide with Open in
 *  livedocuments under it, beside the iframe snippet that places it. */
export function EmbeddedDocument() {
  return (
    <Scene w={420} h={210} bg="plain">
      <Sheet x={18} y={16} w={384} h={180}>
        <rect x={32} y={28} width={120} height={6} rx={3} className="fill-slate-300" />
        <Lines x={32} y={42} w={240} n={1} />
        <rect
          x={32}
          y={54}
          width={240}
          height={116}
          rx={4}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={0.75}
        />
        <Sheet x={46} y={62} w={176} h={84}>
          <SlideContent x={46} y={62} w={176} h={84} title="Q3 Results" />
        </Sheet>
        <rect
          x={40}
          y={153}
          width={110}
          height={12}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={0.75}
        />
        <Label x={95} y={159.5} size={9} weight={500} tone="body" anchor="middle">
          Open in livedocuments
        </Label>
        <Lines x={32} y={178} w={240} n={1} />
        <g className="help-art-as-drawn">
          <rect x={286} y={54} width={104} height={86} rx={5} className="fill-slate-800" />
          {[
            ['<iframe', 'fill-emerald-300'],
            ['  src=".../embed"', 'fill-slate-300'],
            ['  width="800"', 'fill-slate-300'],
            ['  height="450">', 'fill-slate-300'],
            ['</iframe>', 'fill-emerald-300'],
          ].map(([t, c], i) => (
            <text
              key={i}
              x={294}
              y={70 + i * 13}
              fontSize={9}
              className={c}
              style={{ fontFamily: 'ui-monospace, monospace' }}
            >
              {t}
            </text>
          ))}
        </g>
      </Sheet>
    </Scene>
  );
}

/** An agent's change toast: who changed how many elements and why, with Show and Undo, over the slide it changed
 *  (the new chart outlined). */
export function AgentChangeToast() {
  return (
    <Scene w={420} h={210}>
      <Page x={80} y={30} w={260} h={112} name="Results" bar={{ look: false }}>
        <Heading x={100} y={52} size={12}>
          Q3 Results
        </Heading>
        <Lines x={100} y={66} w={86} n={4} gap={7} />
        <BarChart x={226} y={48} w={96} h={80} />
      </Page>
      <rect
        x={220}
        y={42}
        width={108}
        height={92}
        rx={2}
        className="fill-none stroke-violet-500"
        strokeWidth={1.5}
      />
      <Card x={70} y={152} w={280} h={46}>
        <Icon prims={lucideInfo} x={84} y={165} size={9} />
        <Label x={94} y={165.5} size={9.5} tone="strong">
          Claude changed 2 elements: add a results chart
        </Label>
        <Icon prims={lucideX} x={338} y={165} size={8} className="stroke-slate-400" />
        <rect
          x={92}
          y={176}
          width={38}
          height={16}
          rx={4}
          className="fill-white stroke-slate-200"
          strokeWidth={0.75}
        />
        <Label x={111} y={184.5} size={9} weight={600} tone="body" anchor="middle">
          Show
        </Label>
        <rect x={136} y={176} width={38} height={16} rx={4} className="fill-brand-600" />
        <Label x={155} y={184.5} size={9} weight={600} tone="onAccent" anchor="middle">
          Undo
        </Label>
      </Card>
    </Scene>
  );
}
