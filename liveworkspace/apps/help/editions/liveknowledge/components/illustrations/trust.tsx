import type { ReactNode } from 'react';
import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import {
  Btn,
  Chevron,
  ChoiceRow,
  DialogCard,
  HAIR,
  Lines,
  Pill,
  StackedBar,
  Surface,
  VerifiedBadge,
  verifiedBadgeWidth,
} from './kit';

// The Trust figures (liveworkspace/docs/specs/017-help/help-centre.md "Figures and card icons"): a page before and
// after Verify, the three states, the Review Period's popover, the Page Health card, and Knowledge
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

/** The Review Period's popover, opened from Page Health's Change: its five choices, for every page of the
 *  knowledgebase, with a shorter period asking before it is applied. */
export function ReviewPeriodPopover({ asking = true }: { asking?: boolean }) {
  return (
    <Scene w={W} h={214} bg="plain">
      <DialogCard
        x={80}
        y={10}
        w={260}
        h={194}
        title="Review Period"
        line="Applies to every page in this knowledgebase."
      >
        <Label x={94} y={56} size={6.6} tone="muted">
          A verified page comes due for review this long after it was last verified.
        </Label>
        {PERIODS.map((label, i) =>
          asking && i === 0 ? (
            <g key={label}>
              <rect
                x={94}
                y={65}
                width={232}
                height={16}
                rx={5}
                className="fill-amber-50 stroke-amber-400"
                strokeWidth={1.1}
              />
              <Label x={103} y={73.4} size={8} weight={600} tone="strong">
                {label}
              </Label>
            </g>
          ) : (
            <ChoiceRow key={label} x={94} y={65 + i * 19} w={232} label={label} chosen={i === 1} />
          ),
        )}
        {asking ? (
          <g>
            <rect
              x={94}
              y={164}
              width={232}
              height={20}
              rx={5}
              className="fill-amber-50 stroke-amber-200"
              strokeWidth={HAIR}
            />
            <Label x={102} y={174.4} size={6.6} weight={600} className="fill-amber-800">
              12 pages will be due for review with Every 30 Days.
            </Label>
            <Btn x={258} y={167} w={30} h={14} label="Cancel" size={6.6} />
            <Btn x={291} y={167} w={30} h={14} label="Apply" variant="primary" size={6.6} />
          </g>
        ) : (
          <Label x={94} y={176} size={6.8} tone="muted">
            Every page&apos;s due date moves at once. No page is rewritten.
          </Label>
        )}
      </DialogCard>
    </Scene>
  );
}

/** A ring filled to `share` of its way round, centred on (cx, cy): the Health Score's and the freshness ring. */
function Ring({ cx, cy, r, share }: { cx: number; cy: number; r: number; share: number }) {
  const turn = 2 * Math.PI * share;
  const ex = cx + r * Math.sin(turn);
  const ey = cy - r * Math.cos(turn);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="fill-none stroke-slate-200" strokeWidth={2.2} />
      <path
        d={`M${cx} ${cy - r} A${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${ex} ${ey}`}
        className="fill-none stroke-brand-600"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </g>
  );
}

/** The right rail beside a page (PageHealthCard.tsx): On This Page, then Page Health, its Health Score (Score
 *  Breakdown folded under it) over the Verified panel with Verify Again (Page Details folded under it), and Read This
 *  Week at the rail's foot. */
export function PageHealthRail() {
  const x = 242;
  return (
    <Scene w={W} h={244} bg="plain">
      {/* The page, beside the rail. */}
      <Surface x={16} y={12} w={212} h={220} r={8}>
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
      <Surface x={x - 6} y={60} w={168} h={116} r={8}>
        <Label x={x + 4} y={72} size={6.5} weight={700} tone="muted">
          PAGE HEALTH
        </Label>
        {/* The Health Score: the ring, its word and the main reason; pressing it opens Score Breakdown. */}
        <Ring cx={x + 16} cy={94} r={10} share={0.92} />
        <Label x={x + 16} y={94.5} anchor="middle" size={7} weight={700} tone="strong">
          92
        </Label>
        <Label x={x + 34} y={89} size={8.5} weight={700} tone="strong">
          Healthy
        </Label>
        <Label x={x + 34} y={101} size={7} tone="muted">
          1 open comment
        </Label>
        <Chevron cx={x + 150} cy={94} />
        <line
          x1={x - 2}
          y1={113}
          x2={x + 158}
          y2={113}
          className="stroke-slate-200"
          strokeWidth={HAIR}
        />
        {/* The Verified panel: its freshness ring, the state and its line; Page Details folded behind the chevron. */}
        <rect x={x} y={119} width={156} height={50} rx={6} className="fill-brand-50" />
        <Ring cx={x + 13} cy={133} r={6.5} share={0.58} />
        <Label x={x + 26} y={129} size={8} weight={700} tone="strong">
          Verified
        </Label>
        <Label x={x + 26} y={140} size={7} tone="muted">
          Fresh for 52 more days
        </Label>
        <Chevron cx={x + 146} cy={133} />
        <Btn x={x + 6} y={149} w={144} h={14} label="Verify Again" size={7.5} />
      </Surface>
      {/* Read This Week, at the rail's foot. */}
      <Surface x={x - 6} y={184} w={168} h={48} r={8}>
        <Label x={x + 4} y={196} size={6.5} weight={700} tone="muted">
          READ THIS WEEK
        </Label>
        <Label x={x + 4} y={216} size={11} weight={800} tone="strong">
          14
        </Label>
        <Label x={x + 20} y={216.5} size={7.5} tone="body">
          by People
        </Label>
        <Label x={x + 82} y={216} size={11} weight={800} tone="strong">
          32
        </Label>
        <Label x={x + 98} y={216.5} size={7.5} tone="body">
          by Agents
        </Label>
      </Surface>
    </Scene>
  );
}

/** Knowledge Health in Insights: one stacked bar of the three states, its legend, and Remind the Owners. */
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
