// The Agents page's card drawings (docs/specs/019-marketing/marketing-site.md "Feature pages", `agents`): the MCP
// server, the command line, Always in Context, trust fields, suggested edits and AI Knowledge. The tool and command
// names are the MCP server's and the CLI's own.
import { Agent, Arrow, Bars, Button, PageGlyph, Pill, Scene, Sheet, Tick, Txt, at } from './kit';

/** An agent calling the MCP server's tools, each answered from the knowledgebase. */
export function McpArt() {
  const calls = ['get_context', 'search_pages', 'read_page'];
  return (
    <Scene>
      <Agent x={22} y={36} s={22} />
      <Txt x={33} y={70} size={5.8} weight={600} tone="quiet" anchor="middle">
        Your AI
      </Txt>
      {calls.map((c, i) => (
        <g key={c} className="kb-in" style={at(0.3 + i * 0.4)}>
          <Arrow x1={52} x2={92} y={26 + i * 22} delay={0.3 + i * 0.4} />
          <rect
            x={96}
            y={19 + i * 22}
            width={76}
            height={14}
            rx={3.5}
            className="fill-slate-800 dark:fill-slate-950"
          />
          <Txt x={102} y={28.4 + i * 22} size={6.2} weight={600} mono tone="brand">
            {c}
          </Txt>
        </g>
      ))}
      <Sheet x={190} y={14} w={96} h={68} lime>
        <Txt x={198} y={28} size={6.2} weight={700}>
          Knowledgebase
        </Txt>
        <PageGlyph x={198} y={36} />
        <Bars x={208} y={38} widths={[60]} />
        <PageGlyph x={198} y={50} />
        <Bars x={208} y={52} widths={[48]} />
        <PageGlyph x={198} y={64} />
        <Bars x={208} y={66} widths={[66]} />
      </Sheet>
    </Scene>
  );
}

/** A terminal: the CLI's `export`, a knowledgebase as a folder of Markdown with relative links. */
export function CliArt() {
  return (
    <Scene>
      <rect
        x={24}
        y={8}
        width={252}
        height={80}
        rx={6}
        className="fill-slate-900 dark:fill-slate-950 dark:stroke-slate-700"
        strokeWidth={0.8}
      />
      {['fill-rose-400', 'fill-yellow-300', 'fill-emerald-400'].map((f, i) => (
        <circle key={f} cx={34 + i * 8} cy={16} r={2.2} className={f} />
      ))}
      <Txt x={34} y={32} size={6.4} weight={500} mono tone="brand">
        $ liveknowledge export handbook ./handbook
      </Txt>
      {['README.md', 'how-we-work.md', 'onboarding/tools.md'].map((f, i) => (
        <text
          key={f}
          x={34}
          y={45 + i * 10}
          fontSize={6.2}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          className="kb-in fill-slate-300"
          style={at(0.6 + i * 0.3)}
        >
          {`  handbook/${f}`}
        </text>
      ))}
      <text
        x={34}
        y={82}
        fontSize={6.2}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        className="kb-in fill-emerald-300"
        style={at(1.6)}
      >
        ✓ 24 pages, links kept relative
      </text>
    </Scene>
  );
}

/** Always in Context: the pages every agent is handed first, against the budget. */
export function AlwaysInContextArt() {
  const pages = [
    { t: 'How We Write Code', n: '1,200' },
    { t: 'Glossary', n: '900' },
    { t: 'Service Map', n: '2,100' },
  ];
  return (
    <Scene>
      <Sheet x={40} y={6} w={220} h={84}>
        <Txt x={50} y={19} size={5.8} weight={700} tone="quiet">
          ALWAYS IN CONTEXT
        </Txt>
        {pages.map((p, i) => (
          <g key={p.t} className="kb-in" style={at(0.3 + i * 0.25)}>
            <PageGlyph x={52} y={26 + i * 13} />
            <Txt x={62} y={32.5 + i * 13} size={6.4} weight={600}>
              {p.t}
            </Txt>
            <Txt x={250} y={32.5 + i * 13} size={5.8} weight={500} tone="quiet" anchor="end">
              {`About ${p.n} tokens`}
            </Txt>
          </g>
        ))}
        <rect
          x={50}
          y={72}
          width={200}
          height={5}
          rx={2.5}
          className="fill-slate-100 dark:fill-slate-700"
        />
        <rect
          x={50}
          y={72}
          width={105}
          height={5}
          rx={2.5}
          className="kb-fill fill-brand-500"
          style={at(0.5)}
        />
        <Txt x={250} y={86} size={5.4} weight={500} tone="quiet" anchor="end">
          4,200 of 8,000 tokens
        </Txt>
      </Sheet>
    </Scene>
  );
}

/** A passage as an agent receives it: its words, then how far to trust them. */
export function TrustFieldsArt() {
  const fields = [
    ['verified', 'true'],
    ['verifiedBy', 'Priya'],
    ['reviewDue', 'false'],
  ];
  return (
    <Scene>
      <Sheet x={20} y={8} w={128} h={80}>
        <PageGlyph x={28} y={15} />
        <Txt x={38} y={21.5} size={6.4} weight={700}>
          Release Process
        </Txt>
        <Bars x={28} y={30} widths={[110, 100, 112, 70]} gap={8} />
        <Tick cx={33} cy={73} r={3.6} />
        <Txt x={40} y={75.4} size={5.8} weight={600}>
          Verified 12 Nov
        </Txt>
      </Sheet>
      <rect
        x={156}
        y={8}
        width={124}
        height={80}
        rx={5}
        className="fill-slate-900 dark:fill-slate-950 dark:stroke-slate-700"
        strokeWidth={0.8}
      />
      {fields.map(([k, v], i) => (
        <g key={k} className="kb-in" style={at(0.6 + i * 0.25)}>
          <text
            x={164}
            y={26 + i * 14}
            fontSize={6.2}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            className="fill-brand-300"
          >
            {k}
          </text>
          <text
            x={272}
            y={26 + i * 14}
            fontSize={6.2}
            textAnchor="end"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            className="fill-slate-200"
          >
            {v}
          </text>
        </g>
      ))}
      <text
        x={164}
        y={70}
        fontSize={6.2}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        className="fill-brand-300"
      >
        disagreesWith
      </text>
      <text
        x={272}
        y={70}
        fontSize={6.2}
        textAnchor="end"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        className="fill-slate-200"
      >
        none
      </text>
    </Scene>
  );
}

/** An agent's suggested edit: its reason, the lines removed and added, Accept and Dismiss. */
export function SuggestedEditArt() {
  return (
    <Scene>
      <Sheet x={30} y={6} w={240} h={84}>
        <Agent x={38} y={13} s={12} />
        <Txt x={55} y={21.6} size={6.4} weight={700}>
          Coding Agent suggests an edit
        </Txt>
        <Pill x={200} y={14} w={62} tone="plain">
          Release Process
        </Pill>
        <rect
          x={38}
          y={30}
          width={224}
          height={11}
          rx={2}
          className="fill-rose-50 dark:fill-rose-950"
        />
        <Txt x={42} y={37.6} size={6} weight={500}>
          − Deploys go out on Thursdays.
        </Txt>
        <rect
          x={38}
          y={43}
          width={224}
          height={11}
          rx={2}
          className="fill-emerald-50 dark:fill-emerald-950"
        />
        <Txt x={42} y={50.6} size={6} weight={500}>
          + Deploys go out on Tuesdays and Thursdays.
        </Txt>
        <Txt x={38} y={66} size={5.6} weight={500} tone="quiet">
          Reason: the release calendar changed on 3 Nov.
        </Txt>
        <Button x={176} y={72} w={40} filled>
          Accept
        </Button>
        <Button x={220} y={72} w={42}>
          Dismiss
        </Button>
      </Sheet>
    </Scene>
  );
}

/** The AI Knowledge tab: connected agents, questions nobody could answer, pages that disagree. */
export function AiKnowledgeArt() {
  const tiles = [
    { label: 'AGENTS', big: '3', line: 'read 128 pages this week' },
    { label: 'UNANSWERED', big: '5', line: 'questions to write up' },
    { label: 'DISAGREE', big: '1', line: 'pair of pages' },
  ];
  return (
    <Scene>
      {tiles.map((t, i) => (
        <g key={t.label} className="kb-in" style={at(0.2 + i * 0.3)}>
          <Sheet x={14 + i * 92} y={14} w={86} h={68}>
            <Txt x={22 + i * 92} y={28} size={5.6} weight={700} tone="quiet">
              {t.label}
            </Txt>
            <Txt x={22 + i * 92} y={52} size={18} weight={700} tone="brand">
              {t.big}
            </Txt>
            <Txt x={22 + i * 92} y={70} size={5.4} weight={500} tone="quiet">
              {t.line}
            </Txt>
          </Sheet>
        </g>
      ))}
    </Scene>
  );
}
