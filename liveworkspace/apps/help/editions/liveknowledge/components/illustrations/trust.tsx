import type { ReactNode } from 'react';
import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import {
  Btn,
  ChoiceRow,
  DialogCard,
  FieldRow,
  HAIR,
  Lines,
  Pill,
  StackedBar,
  Surface,
  VerifiedBadge,
  verifiedBadgeWidth,
} from './kit';

// The Trust figures (liveworkspace/docs/specs/017-help/help-centre.md "Figures and card icons"): a page before and
// after Verify, the three states, the Review Period in Knowledgebase Settings, the Page Health card, and Knowledge
// Health with its reminder.

const W = 420;

/** A page's head as the reading column draws it: the title and the meta row under it. */
function Head({
  x,
  y,
  title,
  children,
}: {
  x: number;
  y: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <g>
      <Label x={x} y={y} size={13} weight={800} tone="strong">
        {title}
      </Label>
      {children}
    </g>
  );
}

/** Before and after Verify: the meta row gains the tick, who vouched, and when the review comes due. */
export function VerifyAPage() {
  const badge = verifiedBadgeWidth('Maya Chen');
  return (
    <Scene w={W} h={150} bg="plain">
      <Surface x={16} y={12} w={388} h={58} r={8}>
        <Label x={28} y={24} size={6.5} weight={700} tone="muted">
          BEFORE
        </Label>
        <Head x={28} y={40} title="Deploying">
          <Btn x={28} y={50} w={38} h={14} label="Verify" size={7.5} />
        </Head>
      </Surface>
      <Surface x={16} y={80} w={388} h={58} r={8}>
        <Label x={28} y={92} size={6.5} weight={700} tone="muted">
          AFTER
        </Label>
        <Head x={28} y={108} title="Deploying">
          <VerifiedBadge x={28} y={125} by="Maya Chen" after="Review due 10 Jun" />
          <Btn x={28 + badge + 82} y={118} w={60} h={14} label="Verify Again" size={7.5} />
        </Head>
      </Surface>
    </Scene>
  );
}

/** The three states side by side, as the meta row shows each. */
export function TrustStates() {
  const cards: readonly { x: number; name: string; when: string }[] = [
    { x: 16, name: 'Verified', when: 'Verified and not yet due' },
    { x: 148, name: 'Review Due', when: 'The Review Period has passed' },
    { x: 280, name: 'Never Verified', when: 'Nobody has verified it' },
  ];
  return (
    <Scene w={W} h={112} bg="plain">
      {cards.map((card) => (
        <Surface key={card.name} x={card.x} y={12} w={124} h={88} r={8}>
          <Label x={card.x + 12} y={28} size={9} weight={700} tone="strong">
            {card.name}
          </Label>
          <Label x={card.x + 12} y={42} size={6.8} tone="muted">
            {card.when}
          </Label>
          <line
            x1={card.x}
            y1={54}
            x2={card.x + 124}
            y2={54}
            className="stroke-slate-100"
            strokeWidth={HAIR}
          />
        </Surface>
      ))}
      <VerifiedBadge x={28} y={70} by="Maya" />
      <Label x={28} y={87} size={6.8} tone="muted">
        Review due 10 Jun
      </Label>
      <Pill x={160} y={70} label="Review Due" tone="amber" size={7.5} h={13} />
      <Label x={160} y={87} size={6.8} tone="muted">
        Review was due 2 Mar
      </Label>
      <Label x={292} y={70.4} size={7.5} tone="muted">
        No mark on the page
      </Label>
      <Label x={292} y={87} size={6.8} tone="muted">
        Grey in the counts
      </Label>
    </Scene>
  );
}

const PERIODS = [
  'Every 30 Days',
  'Every 90 Days',
  'Every 180 Days',
  'Every Year',
  'Never',
] as const;

/** Knowledgebase Settings: the Review Period's five choices, with a shorter period asking before it is applied. */
export function ReviewPeriodSettings({ asking = true }: { asking?: boolean }) {
  return (
    <Scene w={W} h={248} bg="plain">
      <DialogCard
        x={80}
        y={10}
        w={260}
        h={228}
        title="Knowledgebase Settings"
        line="What every page of this knowledgebase follows."
      >
        <Label x={94} y={54} size={6.5} weight={700} tone="muted">
          REVIEWS
        </Label>
        <Label x={94} y={67} size={8.5} weight={700} tone="strong">
          Review Period
        </Label>
        <Label x={94} y={79} size={6.6} tone="muted">
          A verified page comes due for review this long after it was last verified.
        </Label>
        {PERIODS.map((label, i) =>
          asking && i === 0 ? (
            <g key={label}>
              <rect
                x={94}
                y={88}
                width={232}
                height={16}
                rx={5}
                className="fill-amber-50 stroke-amber-400"
                strokeWidth={1.1}
              />
              <Label x={103} y={96.4} size={8} weight={600} tone="strong">
                {label}
              </Label>
            </g>
          ) : (
            <ChoiceRow key={label} x={94} y={88 + i * 19} w={232} label={label} chosen={i === 1} />
          ),
        )}
        {asking ? (
          <g>
            <rect
              x={94}
              y={186}
              width={232}
              height={20}
              rx={5}
              className="fill-amber-50 stroke-amber-200"
              strokeWidth={HAIR}
            />
            <Label x={102} y={196.4} size={6.6} weight={600} className="fill-amber-800">
              12 pages will be due for review with Every 30 Days.
            </Label>
            <Btn x={258} y={189} w={30} h={14} label="Cancel" size={6.6} />
            <Btn x={291} y={189} w={30} h={14} label="Apply" variant="primary" size={6.6} />
          </g>
        ) : (
          <Label x={94} y={196} size={6.8} tone="muted">
            A change applies to every page at once. No page is rewritten.
          </Label>
        )}
        <Btn x={286} y={214} w={40} h={15} label="Done" variant="primary" />
      </DialogCard>
    </Scene>
  );
}

/** The right rail beside a page: On This Page, then the Page Health card. */
export function PageHealthRail() {
  const x = 242;
  return (
    <Scene w={W} h={232} bg="plain">
      {/* The page, beside the rail. */}
      <Surface x={16} y={12} w={212} h={208} r={8}>
        <Label x={30} y={30} size={6.5} tone="muted">
          Engineering
        </Label>
        <Label x={30} y={46} size={13} weight={800} tone="strong">
          Deploying
        </Label>
        <VerifiedBadge x={30} y={63} by="Maya Chen" />
        <Lines x={30} y={80} widths={[184, 170, 120]} />
        <Label x={30} y={112} size={9} weight={700} tone="strong">
          Before You Deploy
        </Label>
        <Lines x={30} y={124} widths={[184, 150]} />
        <Label x={30} y={148} size={9} weight={700} tone="strong">
          Rolling Back
        </Label>
        <Lines x={30} y={160} widths={[184, 176, 90]} />
      </Surface>
      <Label x={x} y={22} size={6.5} weight={700} tone="muted">
        ON THIS PAGE
      </Label>
      <Label x={x} y={36} size={7.5} weight={600} className="fill-brand-700">
        Before You Deploy
      </Label>
      <Label x={x} y={49} size={7.5} tone="body">
        Rolling Back
      </Label>
      <Surface x={x - 6} y={62} w={168} h={158} r={8}>
        <Label x={x + 4} y={76} size={8.5} weight={700} tone="strong">
          Page Health
        </Label>
        <Label x={x + 4} y={93} size={7} tone="muted">
          Owner
        </Label>
        <rect
          x={x + 76}
          y={86}
          width={78}
          height={14}
          rx={4}
          className="fill-white stroke-slate-300"
          strokeWidth={HAIR}
        />
        <Label x={x + 82} y={93.4} size={7} weight={600} tone="strong">
          Maya Chen
        </Label>
        <path
          d={`M${x + 144} ${92} l2.4 2.6 l2.4 -2.6`}
          className="fill-none stroke-slate-400"
          strokeWidth={1.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <FieldRow x={x + 4} y={110} w={150} label="Last Verified" value="12 Mar by Maya Chen" />
        <FieldRow x={x + 4} y={125} w={150} label="Review Due" value="10 Jun" />
        <FieldRow x={x + 4} y={140} w={150} label="Review Period" value="Every 90 Days" />
        <Label x={x + 154} y={151} anchor="end" size={7} weight={600} className="fill-brand-700">
          Change
        </Label>
        <FieldRow x={x + 4} y={166} w={150} label="Reads by People This Week" value="14" />
        <FieldRow x={x + 4} y={181} w={150} label="Reads by Agents This Week" value="32" />
        <Btn x={x + 4} y={196} w={150} h={16} label="Verify Again" />
      </Surface>
    </Scene>
  );
}

/** Knowledge Health in AI Knowledge: one stacked bar of the three states, its legend, and Remind the Owners. */
export function KnowledgeHealthBar() {
  const total = 64;
  const parts = [
    { name: 'Verified', pages: 46, fill: 'fill-brand-700' },
    { name: 'Review Due', pages: 12, fill: 'fill-amber-400' },
    { name: 'Never Verified', pages: 6, fill: 'fill-slate-300' },
  ];
  let legendX = 30;
  return (
    <Scene w={W} h={120} bg="plain">
      <Surface x={16} y={12} w={388} h={96} r={8}>
        <Label x={30} y={30} size={10} weight={700} tone="strong">
          Knowledge Health
        </Label>
        <Label x={30} y={44} size={7} tone="muted">
          How much of this knowledgebase someone vouches for.
        </Label>
        <Btn x={300} y={22} w={92} h={16} label="Remind the Owners" size={7.5} />
        <StackedBar
          x={30}
          y={58}
          w={360}
          h={9}
          parts={parts.map((p) => ({ share: p.pages / total, className: p.fill }))}
        />
        {parts.map((part) => {
          const at = legendX;
          legendX += 30 + part.name.length * 4.3 + 20;
          return (
            <g key={part.name}>
              <rect x={at} y={82} width={7} height={7} rx={2} className={part.fill} />
              <Label x={at + 11} y={85.9} size={7.5} tone="body">
                {part.name}
              </Label>
              <Label
                x={at + 15 + part.name.length * 4.3}
                y={85.9}
                size={7.5}
                weight={700}
                tone="strong"
              >
                {part.pages}
              </Label>
            </g>
          );
        })}
      </Surface>
    </Scene>
  );
}
