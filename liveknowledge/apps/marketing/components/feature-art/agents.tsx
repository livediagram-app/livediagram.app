// The Knowledgebase Your Agents Read: a passage as an agent receives it, with its trust fields; the agents that
// are connected; an edit an agent suggests for a person to accept; and a question nobody could answer.
import { ArtPanel, AgentGlyph, Board, Button, Card, Label, T, at } from './kit';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// What search_pages hands back with a passage: the names are the MCP server's own
// (docs/specs/024-agents/knowledgebase-for-agents.md "What is built").
const FIELDS: readonly [string, string, boolean?][] = [
  ['page', 'Release Runbook'],
  ['verified', 'verified', true],
  ['verified_at', '2026-11-12', true],
  ['stale', 'false'],
  ['conflicts_with', 'none'],
];

// The agents that read this knowledgebase, and how many pages each read this week.
const AGENTS: readonly [string, string][] = [
  ['Coding Agent', 'MCP, 128 reads'],
  ['Support Assistant', 'MCP, 61 reads'],
  ['Release Script', 'CLI, 14 reads'],
];

function Mono({
  x,
  y,
  className,
  children,
}: {
  x: number;
  y: number;
  className: string;
  children: string;
}) {
  return (
    <text x={x} y={y} fontSize={11} fontFamily={MONO} className={className}>
      {children}
    </text>
  );
}

export function AgentsArt() {
  return (
    <ArtPanel>
      <Board>
        {/* A tool call and its answer: the passage, and how far to trust it. */}
        <rect x={19} y={25} width={304} height={186} rx={12} className="fill-brand-400" />
        <rect
          x={14}
          y={20}
          width={304}
          height={186}
          rx={12}
          strokeWidth={2}
          className="fill-slate-900 stroke-slate-900 dark:fill-slate-950 dark:stroke-slate-200"
        />
        <Mono x={30} y={46} className="fill-brand-300">
          {'search_pages("when do we deploy")'}
        </Mono>
        {FIELDS.map(([key, value, trust], i) => (
          <g key={key} className="kb-in" style={at(0.4 + i * 0.25)}>
            <Mono x={30} y={72 + i * 20} className="fill-slate-400">
              {key}
            </Mono>
            <Mono x={146} y={72 + i * 20} className={trust ? 'fill-emerald-300' : 'fill-slate-100'}>
              {value}
            </Mono>
          </g>
        ))}
        <path d="M30 164 h272" strokeWidth={1} className="stroke-slate-700" />
        <Mono x={30} y={186} className="fill-slate-100">
          We deploy Monday to Thursday.
        </Mono>

        {/* Who is connected. */}
        <Card x={338} y={20} w={168} h={186}>
          <Label x={354} y={46}>
            CONNECTED AGENTS
          </Label>
          {AGENTS.map(([name, how], i) => {
            const y = 62 + i * 46;
            return (
              <g key={name} className="kb-in" style={at(0.6 + i * 0.25)}>
                <AgentGlyph x={354} y={y + 4} s={22} />
                <T x={386} y={y + 13} size={11.5} weight={600}>
                  {name}
                </T>
                <T x={386} y={y + 27} size={10} tone="quiet">
                  {how}
                </T>
              </g>
            );
          })}
          <circle cx={490} cy={42} r={3.5} className="fa-pulse fill-emerald-500" />
        </Card>

        {/* An edit an agent suggests: nothing changes until a person accepts it. */}
        <Card x={14} y={228} w={304} h={128}>
          <Label x={30} y={252}>
            SUGGESTED BY CODING AGENT
          </Label>
          <rect
            x={30}
            y={262}
            width={272}
            height={22}
            rx={6}
            className="fill-rose-100 dark:fill-rose-950"
          />
          <T x={40} y={277} size={11.5} className="fill-rose-800 dark:fill-rose-200">
            - The freeze starts Friday at noon.
          </T>
          <rect
            x={30}
            y={288}
            width={272}
            height={22}
            rx={6}
            className="fill-emerald-100 dark:fill-emerald-950"
          />
          <T x={40} y={303} size={11.5} className="fill-emerald-800 dark:fill-emerald-200">
            + The freeze starts Thursday at 16:00.
          </T>
          <Button x={30} y={318} w={80} filled>
            Accept
          </Button>
          <Button x={118} y={318} w={80}>
            Dismiss
          </Button>
        </Card>

        {/* A question no page answered, kept so someone can write the page. */}
        <Card x={338} y={228} w={168} h={128}>
          <Label x={354} y={252}>
            NOBODY COULD ANSWER
          </Label>
          <T x={354} y={274} size={12} weight={600}>
            How do I rotate
          </T>
          <T x={354} y={290} size={12} weight={600}>
            the API key?
          </T>
          <T x={354} y={308} size={10.5} tone="quiet">
            Asked 4 times
          </T>
          <Button x={354} y={318} w={136}>
            Draft a Page
          </Button>
        </Card>
      </Board>
    </ArtPanel>
  );
}
