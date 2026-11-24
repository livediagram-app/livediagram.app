// The Verification page's card drawings (docs/specs/019-marketing/marketing-site.md "Feature pages", `trust`): the
// owner, the verified tick, the Review Period, Changed Since Verified, Page Health, Yours to Review, the Health Score,
// Required Reading and Not Read in 90 Days.
import type { CSSProperties } from 'react';

import { Avatar, Bars, Button, PageGlyph, Pill, Scene, Sheet, Tick, Txt, at } from './kit';

/** A page's meta row: its owner, and the owner menu offering to hand it on. */
export function OwnerArt() {
  return (
    <Scene>
      <Sheet x={20} y={10} w={150} h={76}>
        <Txt x={28} y={25} size={7.4} weight={700}>
          Release Process
        </Txt>
        <Avatar cx={33} cy={36} r={5} fill="fill-violet-500" initial="P" />
        <Txt x={41} y={38.4} size={6} weight={600}>
          Owner: Priya
        </Txt>
        <Bars x={28} y={50} widths={[128, 110, 120]} />
      </Sheet>
      <Sheet x={150} y={30} w={130} h={56}>
        <Txt x={158} y={42} size={5.6} weight={700} tone="quiet">
          CHANGE OWNER
        </Txt>
        {[
          { i: 'P', n: 'Priya', f: 'fill-violet-500' },
          { i: 'S', n: 'Sam', f: 'fill-sky-500' },
          { i: 'A', n: 'Ade', f: 'fill-emerald-600' },
        ].map((p, k) => (
          <g key={p.n} className="kb-in" style={at(0.6 + k * 0.2)}>
            <Avatar cx={163} cy={51 + k * 11} r={4} fill={p.f} initial={p.i} />
            <Txt x={171} y={53.2 + k * 11} size={6} weight={k ? 500 : 700}>
              {p.n}
            </Txt>
          </g>
        ))}
        <Tick cx={268} cy={51} r={3.6} delay={1.4} />
      </Sheet>
    </Scene>
  );
}

/** The tick in its three places: the meta row, the page tree's row and a page link's hover card. */
export function VerifiedArt() {
  return (
    <Scene>
      <Sheet x={14} y={14} w={130} h={28}>
        <Tick cx={25} cy={28} />
        <Txt x={34} y={26} size={6.4} weight={700}>
          Verified by Priya
        </Txt>
        <Txt x={34} y={35} size={5.6} weight={500} tone="quiet">
          12 Nov · Review due 10 Feb
        </Txt>
      </Sheet>
      <Sheet x={14} y={52} w={130} h={30}>
        <PageGlyph x={22} y={63} />
        <Txt x={32} y={69.5} size={6.4} weight={600}>
          Release Process
        </Txt>
        <Tick cx={132} cy={67} r={3.8} />
      </Sheet>
      <Sheet x={160} y={14} w={126} h={68}>
        <Txt x={168} y={28} size={7} weight={700}>
          Rollback Runbook
        </Txt>
        <Bars x={168} y={36} widths={[104, 90]} />
        <Pill x={168} y={56} w={50} tone="verified">
          Verified
        </Pill>
        <Txt x={224} y={64} size={5.6} weight={500} tone="quiet">
          by Sam, 3 Nov
        </Txt>
      </Sheet>
    </Scene>
  );
}

/** The Review Period's five choices, and a page past it reading Review Due. */
export function ReviewPeriodArt() {
  const choices = ['30 Days', '90 Days', '180 Days', 'Year', 'Never'];
  return (
    <Scene>
      <Txt x={20} y={20} size={5.8} weight={700} tone="quiet">
        REVIEW PERIOD
      </Txt>
      {choices.map((c, i) => (
        <g key={c} className="kb-in" style={at(0.2 + i * 0.1)}>
          <rect
            x={20 + i * 52}
            y={26}
            width={48}
            height={14}
            rx={4}
            strokeWidth={i === 1 ? 1.2 : 0.8}
            className={
              i === 1
                ? 'fill-brand-100 stroke-brand-600 dark:fill-brand-900 dark:stroke-brand-400'
                : 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600'
            }
          />
          <Txt x={44 + i * 52} y={35.4} size={6} weight={i === 1 ? 700 : 500} anchor="middle">
            {c}
          </Txt>
        </g>
      ))}
      <Sheet x={20} y={52} w={256} h={32}>
        <PageGlyph x={30} y={64} />
        <Txt x={40} y={70.5} size={6.6} weight={600}>
          Holiday Policy
        </Txt>
        <Txt x={120} y={70.5} size={5.8} weight={500} tone="quiet">
          verified 4 months ago
        </Txt>
        <Pill x={212} y={62} w={56} h={12} tone="due" delay={1.3}>
          Review Due
        </Pill>
      </Sheet>
    </Scene>
  );
}

/** A verified page rewritten since: its tick, and Changed Since Verified beside it. */
export function ChangedArt() {
  return (
    <Scene>
      <Sheet x={30} y={8} w={240} h={80}>
        <Txt x={40} y={23} size={7.4} weight={700}>
          Expense Policy
        </Txt>
        <Tick cx={45} cy={33} r={4} />
        <Txt x={53} y={35.3} size={6} weight={600}>
          Verified
        </Txt>
        <Pill x={84} y={28} w={84} tone="due" delay={1.6}>
          Changed Since Verified
        </Pill>
        <Bars x={40} y={46} widths={[200, 170]} />
        <rect
          x={40}
          y={60}
          width={150}
          height={3}
          rx={1.5}
          className="kb-type fill-orange-300 dark:fill-orange-700"
          style={at(0.8)}
        />
        <rect
          x={40}
          y={67}
          width={176}
          height={3}
          rx={1.5}
          className="kb-type fill-orange-300 dark:fill-orange-700"
          style={at(0.95)}
        />
        <rect
          x={40}
          y={74}
          width={120}
          height={3}
          rx={1.5}
          className="kb-type fill-orange-300 dark:fill-orange-700"
          style={at(1.1)}
        />
      </Sheet>
    </Scene>
  );
}

/** The right rail's Page Health: the freshness ring, its line, the facts and Verify Again. */
export function PageHealthArt() {
  // The ring: 80 of 90 days left.
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <Scene>
      <Sheet x={60} y={6} w={180} h={84}>
        <Txt x={70} y={18} size={5.6} weight={700} tone="quiet">
          PAGE HEALTH
        </Txt>
        <circle
          cx={86}
          cy={39}
          r={r}
          fill="none"
          strokeWidth={3.4}
          className="stroke-emerald-100 dark:stroke-emerald-900"
        />
        <circle
          cx={86}
          cy={39}
          r={r}
          fill="none"
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeDasharray={`${c * 0.89} ${c}`}
          transform="rotate(-90 86 39)"
          className="kb-draw stroke-emerald-500"
          style={{ ...at(0.4), '--len': `${c}` } as CSSProperties}
        />
        <Tick cx={86} cy={39} r={5} />
        <Txt x={106} y={36} size={7} weight={700}>
          Verified
        </Txt>
        <Txt x={106} y={45} size={5.8} weight={500} tone="quiet">
          Fresh for 80 more days
        </Txt>
        <Txt x={70} y={65} size={5.8} weight={500} tone="quiet">
          Owner
        </Txt>
        <Txt x={110} y={65} size={5.8} weight={600}>
          Priya
        </Txt>
        <Txt x={70} y={76} size={5.8} weight={500} tone="quiet">
          Read This Week
        </Txt>
        <Txt x={128} y={76} size={5.8} weight={600}>
          14 people · 9 agents
        </Txt>
        <Button x={192} y={57} w={42}>
          Verify Again
        </Button>
      </Sheet>
    </Scene>
  );
}

/** The Knowledgebase Home's Yours to Review: pages you own that are due, each with Still Right. */
export function YoursToReviewArt() {
  const due = ['Holiday Policy', 'VPN Setup', 'Deploy Checklist'];
  return (
    <Scene>
      <Sheet x={40} y={6} w={220} h={84}>
        <Txt x={50} y={19} size={5.8} weight={700} tone="quiet">
          YOURS TO REVIEW
        </Txt>
        {due.map((t, i) => (
          <g key={t} className="kb-in" style={at(0.3 + i * 0.3)}>
            <PageGlyph x={52} y={26 + i * 20} />
            <Txt x={62} y={32.5 + i * 20} size={6.4} weight={600}>
              {t}
            </Txt>
            <Pill x={142} y={25.5 + i * 20} w={46} tone="due">
              Review Due
            </Pill>
            <Button x={196} y={25 + i * 20} w={54} filled>
              Still Right
            </Button>
          </g>
        ))}
      </Sheet>
    </Scene>
  );
}

/** A page's Health Score: its ring, its label, and the reason it lost most. */
export function HealthScoreArt() {
  const factors = [
    { n: 'Verification', w: 60 },
    { n: 'Freshness', w: 44 },
    { n: 'Owner', w: 60 },
  ];
  return (
    <Scene>
      <Sheet x={14} y={10} w={272} h={76}>
        <circle
          cx={50}
          cy={46}
          r={22}
          strokeWidth={5}
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <circle
          cx={50}
          cy={46}
          r={22}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="114 139"
          transform="rotate(-90 50 46)"
          className="kb-in stroke-emerald-500"
          style={at(0.4)}
        />
        <Txt x={50} y={49} size={11} weight={800} anchor="middle">
          82
        </Txt>
        <Pill x={86} y={20} w={40} tone="verified" delay={0.8}>
          Healthy
        </Pill>
        <Txt x={132} y={28} size={5.8} weight={500} tone="quiet">
          Lost most: last edited 8 months ago
        </Txt>
        {factors.map((f, i) => (
          <g key={f.n} className="kb-in" style={at(1 + i * 0.2)}>
            <Txt x={86} y={46 + i * 12} size={5.8} weight={600}>
              {f.n}
            </Txt>
            <rect
              x={140}
              y={41.5 + i * 12}
              width={60}
              height={5}
              rx={2.5}
              className="fill-slate-100 dark:fill-slate-700"
            />
            <rect
              x={140}
              y={41.5 + i * 12}
              width={f.w}
              height={5}
              rx={2.5}
              className="fill-emerald-500"
            />
          </g>
        ))}
      </Sheet>
    </Scene>
  );
}

/** The Required Reading banner with I've Read This, and the count beside it. */
export function RequiredReadingArt() {
  return (
    <Scene>
      <Sheet x={14} y={10} w={160} h={76}>
        <Txt x={22} y={24} size={7.2} weight={700}>
          Security Policy
        </Txt>
        <g className="kb-in" style={at(0.4)}>
          <rect
            x={22}
            y={31}
            width={144}
            height={24}
            rx={4}
            className="fill-brand-50 dark:fill-brand-900"
          />
          <Txt x={28} y={41} size={6} weight={700} tone="brand">
            Required Reading
          </Txt>
          <Txt x={28} y={50} size={5.4} weight={500} tone="quiet">
            Please read this page, then confirm.
          </Txt>
        </g>
        <g className="kb-pop" style={at(0.9)}>
          <Button x={108} y={62} w={56} filled>
            I’ve Read This
          </Button>
        </g>
        <Bars x={22} y={64} widths={[78]} />
      </Sheet>
      <Sheet x={186} y={22} w={100} h={52}>
        <Txt x={194} y={35} size={6.2} weight={700}>
          7 of 12 have read it
        </Txt>
        <rect
          x={194}
          y={42}
          width={84}
          height={5}
          rx={2.5}
          className="fill-slate-100 dark:fill-slate-700"
        />
        <rect
          x={194}
          y={42}
          width={49}
          height={5}
          rx={2.5}
          className="kb-in fill-brand-600"
          style={at(1.2)}
        />
        <Txt x={194} y={62} size={5.6} weight={500} tone="quiet">
          Remind the rest
        </Txt>
      </Sheet>
    </Scene>
  );
}

/** Insights' list of pages nobody has read in 90 days, each with when it was last read. */
export function NotReadArt() {
  const rows = [
    { t: 'Old VPN Setup', w: 'Last read 7 months ago' },
    { t: 'Office Wi-Fi', w: 'Last read 4 months ago' },
    { t: '2023 Offsite', w: 'Never read' },
  ];
  return (
    <Scene>
      <Sheet x={14} y={8} w={272} h={80}>
        <Txt x={24} y={22} size={6} weight={700} tone="quiet">
          NOT READ IN 90 DAYS
        </Txt>
        {rows.map((r, i) => (
          <g key={r.t} className="kb-in" style={at(0.4 + i * 0.25)}>
            <PageGlyph x={24} y={30 + i * 17} />
            <Txt x={34} y={36.5 + i * 17} size={6.4} weight={600}>
              {r.t}
            </Txt>
            <Txt x={276} y={36.5 + i * 17} size={5.6} weight={500} tone="quiet" anchor="end">
              {r.w}
            </Txt>
          </g>
        ))}
      </Sheet>
    </Scene>
  );
}
