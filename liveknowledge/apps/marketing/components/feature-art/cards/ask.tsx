// The Ask page's card drawings (docs/specs/019-marketing/marketing-site.md "Feature pages", `ask`): citations, the
// Sources rail, a Knowledge Gap, the team's own key, search with no key, and Save as Page.
import { Bars, Button, PageGlyph, Pill, Scene, Sheet, Tick, Txt, at } from './kit';

/** A citation number, in a small lime box. */
function Cite({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <>
      <rect
        x={x}
        y={y - 6}
        width={9}
        height={8}
        rx={2}
        className="fill-brand-100 dark:fill-brand-900"
      />
      <Txt x={x + 4.5} y={y} size={5.6} weight={700} tone="brand" anchor="middle">
        {n}
      </Txt>
    </>
  );
}

/** An answer whose every claim carries its number. */
export function CitationsArt() {
  return (
    <Scene>
      <Sheet x={20} y={8} w={260} h={80}>
        <Txt x={30} y={22} size={6} weight={700} tone="quiet">
          HOW DO WE ROLL BACK A RELEASE?
        </Txt>
        <Txt x={30} y={38} size={6.8} weight={500}>
          Run the rollback job.
        </Txt>
        <g className="kb-pop" style={at(0.8)}>
          <Cite x={108} y={38} n={1} />
        </g>
        <Txt x={30} y={52} size={6.8} weight={500}>
          Tell #releases once it has finished.
        </Txt>
        <g className="kb-pop" style={at(1.1)}>
          <Cite x={160} y={52} n={2} />
        </g>
        <Txt x={30} y={66} size={6.8} weight={500}>
          The on-call engineer approves it.
        </Txt>
        <g className="kb-pop" style={at(1.4)}>
          <Cite x={152} y={66} n={1} />
        </g>
        <Txt x={30} y={80} size={5.6} weight={600} tone="brand">
          Answered From 2 Verified Pages
        </Txt>
      </Sheet>
    </Scene>
  );
}

/** The Sources rail: each cited passage with its page and who verified it. */
export function SourcesArt() {
  const sources = [
    { n: 1, page: 'Rollback Runbook', by: 'Verified by Sam' },
    { n: 2, page: 'Release Process', by: 'Verified by Priya' },
  ];
  return (
    <Scene>
      <Sheet x={14} y={8} w={110} h={80}>
        <Bars x={22} y={18} widths={[90, 80, 94, 60, 86, 70, 50]} gap={9} />
      </Sheet>
      <Txt x={140} y={18} size={5.8} weight={700} tone="quiet">
        SOURCES
      </Txt>
      {sources.map((s, i) => (
        <g key={s.n} className="kb-in" style={at(0.6 + i * 0.35)}>
          <Sheet x={136} y={24 + i * 33} w={150} h={29}>
            <Cite x={142} y={36 + i * 33} n={s.n} />
            <PageGlyph x={155} y={30 + i * 33} />
            <Txt x={165} y={36.5 + i * 33} size={6.4} weight={700}>
              {s.page}
            </Txt>
            <Tick cx={146.5} cy={45 + i * 33} r={3.2} />
            <Txt x={155} y={47.3 + i * 33} size={5.6} weight={500} tone="quiet">
              {s.by}
            </Txt>
          </Sheet>
        </g>
      ))}
    </Scene>
  );
}

/** A Knowledge Gap: what the pages do not cover, with a way to start that page. */
export function GapArt() {
  return (
    <Scene>
      <Sheet x={30} y={8} w={240} h={80}>
        <Pill x={40} y={16} w={60} tone="due" delay={0.3}>
          Knowledge Gap
        </Pill>
        <Txt x={40} y={42} size={6.8} weight={600}>
          No page covers rolling back a database migration.
        </Txt>
        <Txt x={40} y={54} size={5.8} weight={500} tone="quiet">
          Asked 4 times by people and the Coding Agent
        </Txt>
        <g className="kb-in" style={at(1)}>
          <Button x={40} y={64} w={120} filled>
            Draft a Page From What We Know
          </Button>
        </g>
      </Sheet>
    </Scene>
  );
}

/** AI Settings: the provider, the key's last four characters with Replace and Remove, and the model. */
export function OwnKeyArt() {
  return (
    <Scene>
      <Sheet x={40} y={6} w={220} h={84}>
        <Txt x={50} y={19} size={5.8} weight={700} tone="quiet">
          AI SETTINGS
        </Txt>
        <Pill x={50} y={25} w={40} tone="brand">
          Claude
        </Pill>
        <Pill x={94} y={25} w={40}>
          OpenAI
        </Pill>
        <rect
          x={50}
          y={42}
          width={110}
          height={14}
          rx={3.5}
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-600"
          strokeWidth={0.8}
        />
        <Txt x={56} y={51.5} size={6.2} weight={600} mono>
          Key Ending 4f2a
        </Txt>
        <Button x={166} y={43} w={38}>
          Replace
        </Button>
        <Button x={208} y={43} w={38}>
          Remove
        </Button>
        <Txt x={50} y={72} size={5.8} weight={500} tone="quiet">
          Encrypted when saved, never shown again.
        </Txt>
        <Txt x={50} y={82} size={5.8} weight={500} tone="quiet">
          Your team pays its provider for what it uses.
        </Txt>
      </Sheet>
    </Scene>
  );
}

/** Search: titles first, then passages with the word marked, verified pages first. */
export function SearchArt() {
  return (
    <Scene>
      <Sheet x={30} y={6} w={240} h={84}>
        <rect
          x={38}
          y={12}
          width={224}
          height={14}
          rx={7}
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-600"
          strokeWidth={0.8}
        />
        <circle
          cx={47}
          cy={19}
          r={2.8}
          fill="none"
          strokeWidth={1}
          className="stroke-slate-500 dark:stroke-slate-400"
        />
        <Txt x={54} y={21.4} size={6.4} weight={500}>
          rollback
        </Txt>
        <Pill x={218} y={13.5} w={40} tone="plain">
          No Key
        </Pill>
        <PageGlyph x={40} y={33} />
        <Txt x={50} y={39.5} size={6.6} weight={700}>
          Rollback Runbook
        </Txt>
        <Tick cx={125} cy={37} r={3.4} />
        <Txt x={50} y={50} size={5.8} weight={500} tone="quiet">
          …run the
        </Txt>
        <rect
          x={79}
          y={44.5}
          width={26}
          height={7.5}
          rx={1.5}
          className="kb-type fill-brand-200 dark:fill-brand-800"
          style={at(0.9)}
        />
        <Txt x={80} y={50} size={5.8} weight={600}>
          rollback
        </Txt>
        <Txt x={107} y={50} size={5.8} weight={500} tone="quiet">
          job from the release channel…
        </Txt>
        <PageGlyph x={40} y={60} />
        <Txt x={50} y={66.5} size={6.6} weight={700}>
          Release Process
        </Txt>
        <Bars x={50} y={74} widths={[180]} />
      </Sheet>
    </Scene>
  );
}

/** Save as Page: an answer, with its sources, becomes a subpage of the page picked. */
export function SaveAsPageArt() {
  return (
    <Scene>
      <Sheet x={14} y={8} w={128} h={80}>
        <Txt x={22} y={22} size={6.2} weight={700}>
          How do we roll back?
        </Txt>
        <Bars x={22} y={30} widths={[110, 96, 104, 70]} gap={8} />
        <g className="kb-pop" style={at(0.6)}>
          <Button x={22} y={66} w={60} filled>
            Save as Page
          </Button>
        </g>
      </Sheet>
      <g className="kb-pop" style={at(1.2)}>
        <Sheet x={158} y={20} w={112} h={62}>
          <PageGlyph x={166} y={28} />
          <Txt x={176} y={34.5} size={6.4} weight={700}>
            Rolling Back
          </Txt>
          <Txt x={166} y={46} size={5.4} weight={500} tone="quiet">
            Under Release Process
          </Txt>
          <Bars x={166} y={56} widths={[92, 78, 60]} gap={7} />
        </Sheet>
      </g>
    </Scene>
  );
}
