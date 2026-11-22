// The Pages page's card drawings (docs/specs/019-marketing/marketing-site.md "Feature pages", `pages`): the page
// tree, reading then editing, page links, Linked From, covers and starting from a structure.
import {
  Arrow,
  Avatar,
  Bars,
  Button,
  GUIDE,
  PageGlyph,
  Pill,
  Scene,
  Sheet,
  Tick,
  Txt,
  at,
} from './kit';

/** A page tree: pages under pages, one open with its subpages, the page being read marked. */
export function PageTreeArt() {
  const rows = [
    { d: 0, t: 'Engineering', y: 14 },
    { d: 1, t: 'Release Process', y: 28 },
    { d: 1, t: 'On-Call', y: 42 },
    { d: 0, t: 'Handbook', y: 72 },
  ];
  return (
    <Scene>
      <Sheet x={70} y={6} w={160} h={84} />
      <path
        d="M86 24 V 64 M86 32 H 92 M86 46 H 92 M100 50 V 60 H 106"
        fill="none"
        strokeWidth={0.9}
        className={GUIDE}
      />
      {rows.map((r) => (
        <g key={r.t} className="kb-in" style={at(0.2 + rows.indexOf(r) * 0.18)}>
          <PageGlyph x={78 + r.d * 14} y={r.y - 6} />
          <Txt x={88 + r.d * 14} y={r.y} size={6.6} weight={r.d ? 500 : 700}>
            {r.t}
          </Txt>
        </g>
      ))}
      <rect
        x={104}
        y={50}
        width={118}
        height={11}
        rx={3}
        className="kb-in fill-brand-100/70 dark:fill-brand-900/60"
        style={at(1)}
      />
      <PageGlyph x={106} y={52} />
      <Txt x={116} y={58} size={6.6} weight={700} tone="brand">
        Rollback Runbook
      </Txt>
    </Scene>
  );
}

/** A page read, then the same page in its shared draft: the Edit button, then Editing with Cancel and Save. */
export function ReadEditArt() {
  return (
    <Scene>
      <Sheet x={14} y={10} w={126} h={76}>
        <Txt x={22} y={24} size={7.4} weight={700}>
          Release Process
        </Txt>
        <Button x={104} y={15} w={28} filled>
          Edit
        </Button>
        <Bars x={22} y={36} widths={[100, 90, 104, 70]} />
        <Txt x={22} y={78} size={5.6} weight={500} tone="quiet">
          Reading
        </Txt>
      </Sheet>
      <Sheet x={160} y={10} w={126} h={76} lime>
        <Pill x={166} y={15} w={36} tone="brand">
          Editing
        </Pill>
        <Avatar cx={210} cy={20.5} r={4.5} fill="fill-violet-500" initial="P" />
        <Avatar cx={219} cy={20.5} r={4.5} fill="fill-sky-500" initial="S" />
        <Button x={228} y={15} w={24}>
          Cancel
        </Button>
        <Button x={255} y={15} w={25} filled>
          Save
        </Button>
        <Bars x={168} y={36} widths={[100, 82]} />
        <rect x={168} y={50} width={62} height={3} rx={1.5} className="fill-brand-400" />
        <rect x={231} y={47} width={1} height={8} className="kb-caret fill-violet-500" />
        <Bars x={168} y={57} widths={[96, 60]} />
      </Sheet>
    </Scene>
  );
}

/** Typing [[ offers the pages to link to; the chosen one becomes a link chip in the writing. */
export function PageLinksArt() {
  return (
    <Scene>
      <Sheet x={20} y={12} w={160} h={72}>
        <Txt x={28} y={28} size={6.6} weight={500}>
          Before a release, read
        </Txt>
        <rect
          x={102}
          y={21}
          width={68}
          height={10}
          rx={5}
          className="fill-brand-100 dark:fill-brand-900"
        />
        <PageGlyph x={105} y={22.5} />
        <Txt x={114} y={28.5} size={6} weight={700} tone="brand">
          On-Call
        </Txt>
        <Txt x={28} y={44} size={6.6} weight={500}>
          and ask in
        </Txt>
        <Txt x={66} y={44} size={6.6} weight={700} tone="brand" mono>
          [[run
        </Txt>
        <rect
          x={86}
          y={38}
          width={0.9}
          height={8}
          className="kb-caret fill-slate-800 dark:fill-slate-100"
        />
      </Sheet>
      <g className="kb-in" style={at(0.8)}>
        <Sheet x={130} y={50} w={150} h={40}>
          <rect
            x={134}
            y={54}
            width={142}
            height={11}
            rx={3}
            className="fill-brand-100/70 dark:fill-brand-900/60"
          />
          <PageGlyph x={138} y={56} />
          <Txt x={148} y={62} size={6.4} weight={700} tone="brand">
            Rollback Runbook
          </Txt>
          <PageGlyph x={138} y={70} />
          <Txt x={148} y={76} size={6.4} weight={500}>
            Runbooks Index
          </Txt>
        </Sheet>
      </g>
    </Scene>
  );
}

/** The foot of a page: Linked From, the pages that link to it, each a row. */
export function LinkedFromArt() {
  const from = ['Release Process', 'On-Call', 'New Starter Week'];
  return (
    <Scene>
      <Sheet x={50} y={4} w={200} h={88}>
        <Bars x={60} y={12} widths={[170, 140]} />
        <path d="M60 30 H 240" strokeWidth={0.8} className={GUIDE} />
        <Txt x={60} y={42} size={5.8} weight={700} tone="quiet">
          LINKED FROM
        </Txt>
        {from.map((t, i) => (
          <g key={t} className="kb-in" style={at(0.5 + i * 0.25)}>
            <PageGlyph x={62} y={47 + i * 13} />
            <Txt x={72} y={53.5 + i * 13} size={6.6} weight={600} tone="brand">
              {t}
            </Txt>
          </g>
        ))}
      </Sheet>
    </Scene>
  );
}

/** A page with a gradient cover across its top, and the cover menu's choices. */
export function CoversArt() {
  return (
    <Scene>
      <defs>
        <linearGradient id="kc-cover" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#bef264" />
          <stop offset="0.55" stopColor="#34d399" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <Sheet x={20} y={8} w={170} h={82} />
      <path
        d="M20 13 a5 5 0 0 1 5 -5 h160 a5 5 0 0 1 5 5 v19 h-170 z"
        fill="url(#kc-cover)"
        className="kb-in"
        style={at(1.2)}
      />
      <Txt x={30} y={46} size={7.6} weight={700}>
        Team Handbook
      </Txt>
      <Txt x={30} y={57} size={5.6} weight={500} tone="quiet">
        4 min read · Add Cover
      </Txt>
      <Bars x={30} y={64} widths={[140, 120, 90]} />
      <Sheet x={204} y={14} w={80} h={68}>
        <Txt x={210} y={25} size={5.6} weight={700} tone="quiet">
          COVER
        </Txt>
        <Txt x={210} y={36} size={6} weight={600}>
          Choose a Picture
        </Txt>
        {['#bef264', '#a78bfa', '#38bdf8', '#fb7185'].map((c, i) => (
          <rect
            key={c}
            x={210 + i * 17}
            y={44}
            width={14}
            height={10}
            rx={2}
            fill={c}
            className="kb-pop"
            style={at(0.4 + i * 0.12)}
          />
        ))}
        <rect x={210} y={58} width={14} height={10} rx={2} fill="url(#kc-cover)" />
        <rect
          x={209}
          y={57}
          width={16}
          height={12}
          rx={2.5}
          fill="none"
          strokeWidth={1.1}
          className="stroke-brand-700 dark:stroke-brand-300"
        />
        <Txt x={230} y={65} size={5.6} weight={500} tone="quiet">
          Animated
        </Txt>
      </Sheet>
    </Scene>
  );
}

/** Describe the knowledgebase, and AI proposes its pages: a description, then the suggested tree, ticked. */
export function DescribeArt() {
  const pages = ['Team Handbook', 'How We Work', 'Onboarding', 'Tools'];
  return (
    <Scene>
      <Sheet x={14} y={14} w={118} h={68}>
        <Txt x={20} y={26} size={5.8} weight={700} tone="quiet">
          DESCRIBE TO SET UP
        </Txt>
        <Txt x={20} y={40} size={6.2} weight={500}>
          A handbook for our support
        </Txt>
        <Txt x={20} y={49} size={6.2} weight={500}>
          team: how we work, tools,
        </Txt>
        <Txt x={20} y={58} size={6.2} weight={500}>
          onboarding.
        </Txt>
        <Txt x={20} y={75} size={5.4} weight={500} tone="quiet">
          Uses built-in AI
        </Txt>
      </Sheet>
      <Arrow x1={138} x2={156} y={48} delay={0.6} />
      <Sheet x={162} y={10} w={124} h={76} lime>
        {pages.map((t, i) => (
          <g key={t} className="kb-in" style={at(0.9 + i * 0.3)}>
            <Tick cx={172 + (i ? 8 : 0)} cy={23 + i * 15} r={3.6} delay={1.1 + i * 0.3} />
            <PageGlyph x={179 + (i ? 8 : 0)} y={19 + i * 15} />
            <Txt x={189 + (i ? 8 : 0)} y={25.5 + i * 15} size={6.4} weight={i ? 500 : 700}>
              {t}
            </Txt>
          </g>
        ))}
      </Sheet>
    </Scene>
  );
}
