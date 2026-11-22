import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { Btn, Code, DialogCard, HAIR, MenuRows, Pill, StackedBar, Surface } from './kit';

// The AI Knowledge figures (liveworkspace/docs/specs/017-help/help-centre.md "Figures and card icons"): the Connect
// an Agent dialog, a connected agent's card and its menu, a suggested edit, the questions nobody could answer, two
// pages that disagree, and the Always in Context budget. Each is drawn from the view's own words.

const W = 420;

/** A section's heading in the AI Knowledge view, with its one line under it. */
function SectionHead({
  x,
  y,
  title,
  line,
}: {
  x: number;
  y: number;
  title: string;
  line?: string;
}) {
  return (
    <g>
      <Label x={x} y={y} size={9.5} weight={700} tone="strong">
        {title}
      </Label>
      {line ? (
        <Label x={x} y={y + 12} size={6.8} tone="muted">
          {line}
        </Label>
      ) : null}
    </g>
  );
}

/** A dark code box, as the dialog prints an address or a command. */
function CodeBox({
  x,
  y,
  w,
  lines,
}: {
  x: number;
  y: number;
  w: number;
  lines: readonly string[];
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={8 + lines.length * 10}
        rx={4}
        className="fill-slate-900 help-art-as-drawn"
      />
      {lines.map((line, i) => (
        <Code
          key={line}
          x={x + 7}
          y={y + 9 + i * 10}
          size={6.6}
          className="fill-slate-100 help-art-as-drawn"
        >
          {line}
        </Code>
      ))}
    </g>
  );
}

/** Connect an Agent: what a new connection may do, then the MCP server, the command line and an API token. */
export function ConnectAgentScene() {
  const x = 60;
  return (
    <Scene w={W} h={262} bg="plain">
      <DialogCard
        x={x}
        y={8}
        w={300}
        h={246}
        title="Connect an Agent"
        line="A new connection can read, search and suggest edits."
      >
        <Label x={x + 14} y={52} size={6.6} tone="muted">
          To let it write, choose Allow Writing on its card in Connected Agents.
        </Label>
        <Label x={x + 14} y={72} size={8.5} weight={700} tone="strong">
          MCP Server
        </Label>
        <Label x={x + 14} y={84} size={6.6} tone="muted">
          Add this address to Claude or another AI tool, then approve the connection.
        </Label>
        <CodeBox x={x + 14} y={90} w={272} lines={['https://mcp.liveknowledge.app/mcp']} />
        <Label x={x + 14} y={124} size={8.5} weight={700} tone="strong">
          Command Line
        </Label>
        <Label x={x + 14} y={136} size={6.6} tone="muted">
          Sign in once, then read and suggest from a terminal or a script.
        </Label>
        <CodeBox
          x={x + 14}
          y={142}
          w={272}
          lines={[
            'liveknowledge auth login',
            'liveknowledge context Handbook',
            'liveknowledge search Handbook when do we deploy',
          ]}
        />
        <Label x={x + 14} y={196} size={8.5} weight={700} tone="strong">
          API Token
        </Label>
        <Label x={x + 14} y={208} size={6.6} tone="muted">
          Send a token from Settings as a Bearer token. A read-only one only reads.
        </Label>
        <Btn x={x + 14} y={214} w={72} h={14} label="Open API Tokens" size={6.6} />
        <Btn x={x + 252} y={232} w={34} h={14} label="Done" variant="primary" size={7} />
      </DialogCard>
    </Scene>
  );
}

/** A connected agent's card, and an Editor's menu on it with Allow Writing. */
export function AgentCardScene() {
  const x = 40;
  const y = 22;
  return (
    <Scene w={W} h={170} bg="plain">
      <SectionHead x={x} y={14} title="Connected Agents" />
      <Surface x={x} y={y} w={230} h={132} r={9}>
        <rect
          x={x + 12}
          y={y + 12}
          width={20}
          height={20}
          rx={6}
          className="fill-slate-900 help-art-as-drawn"
        />
        <Code
          x={x + 22}
          y={y + 22.5}
          size={7}
          anchor="middle"
          className="fill-brand-300 help-art-as-drawn"
        >
          {'>_'}
        </Code>
        <Label x={x + 40} y={y + 18} size={8.5} weight={700} tone="strong">
          Coding Agent
        </Label>
        <Label x={x + 40} y={y + 29} size={6.6} tone="muted">
          Through the MCP server · Last seen today
        </Label>
        {/* More. */}
        <rect x={x + 208} y={y + 10} width={14} height={14} rx={4} className="fill-slate-100" />
        {[0, 1, 2].map((d) => (
          <circle key={d} cx={x + 212 + d * 3} cy={y + 17} r={0.9} className="fill-slate-500" />
        ))}
        <Pill x={x + 12} y={y + 48} label="Reads" tone="slate" size={6.8} h={12} />
        <Pill x={x + 50} y={y + 48} label="Suggests Edits" tone="slate" size={6.8} h={12} />
        <Label x={x + 12} y={y + 68} size={6.8} tone="body">
          14 pages read this week
        </Label>
        {['Deploying', 'On-Call', 'Release Process'].map((page, i) => (
          <Label key={page} x={x + 12} y={y + 84 + i * 13} size={7} weight={600} tone="strong">
            {`${i + 1}. ${page}`}
          </Label>
        ))}
      </Surface>
      {/* The menu, open from More. */}
      <Surface x={x + 236} y={y + 6} w={110} h={30} r={7} lift>
        <MenuRows x={x + 240} y={y + 10} w={102} rows={[{ label: 'Allow Writing', hover: true }]} />
      </Surface>
    </Scene>
  );
}

/** An edit an agent suggested: the page, the agent, its reason, the lines out and in, and the three buttons. */
export function SuggestedEditScene() {
  const x = 50;
  const y = 22;
  return (
    <Scene w={W} h={168} bg="plain">
      <SectionHead x={x} y={14} title="Edits Suggested by Agents" />
      <Surface x={x} y={y} w={320} h={136} r={9}>
        <Label x={x + 12} y={y + 16} size={8.5} weight={700} tone="strong">
          Deploying
        </Label>
        <Label x={x + 12} y={y + 28} size={6.6} tone="muted">
          Coding Agent · The deploy day moved in March.
        </Label>
        <rect x={x + 12} y={y + 38} width={296} height={18} rx={4} className="fill-rose-50" />
        <Label
          x={x + 18}
          y={y + 47.4}
          size={7.5}
          weight={700}
          className="fill-rose-700 dark:fill-rose-300"
        >
          −
        </Label>
        <Label
          x={x + 28}
          y={y + 47.4}
          size={7.2}
          className="fill-rose-800 line-through dark:fill-rose-200"
        >
          We deploy on Tuesdays, after the checks pass.
        </Label>
        <rect x={x + 12} y={y + 60} width={296} height={18} rx={4} className="fill-emerald-50" />
        <Label
          x={x + 18}
          y={y + 69.4}
          size={7.5}
          weight={700}
          className="fill-emerald-700 dark:fill-emerald-300"
        >
          +
        </Label>
        <Label
          x={x + 28}
          y={y + 69.4}
          size={7.2}
          className="fill-emerald-800 dark:fill-emerald-200"
        >
          We deploy on Mondays, after the checks pass.
        </Label>
        <line
          x1={x}
          y1={y + 92}
          x2={x + 320}
          y2={y + 92}
          className="stroke-slate-100"
          strokeWidth={HAIR}
        />
        <Btn x={x + 12} y={y + 104} w={44} h={16} label="Accept" variant="primary" size={7.2} />
        <Btn x={x + 62} y={y + 104} w={70} h={16} label="Open the Page" size={7.2} />
        <Btn x={x + 138} y={y + 104} w={46} h={16} label="Dismiss" variant="quiet" size={7.2} />
      </Surface>
    </Scene>
  );
}

const QUESTIONS = [
  { q: 'What is our parental leave policy?', by: 'Asked 4 times by people and the Coding Agent' },
  { q: 'Who is on call at weekends?', by: 'Asked twice by people' },
  { q: 'How do we rotate the API keys?', by: 'Asked once by the CLI' },
] as const;

/** Questions Nobody Could Answer: a row a question, how often it was asked and by whom, Draft a Page and dismiss. */
export function QuestionsScene() {
  const x = 40;
  return (
    <Scene w={W} h={162} bg="plain">
      <SectionHead
        x={x}
        y={14}
        title="Questions Nobody Could Answer"
        line="A question the pages do not cover is kept here, with how often it was asked."
      />
      {QUESTIONS.map((row, i) => {
        const y = 38 + i * 40;
        return (
          <Surface key={row.q} x={x} y={y} w={340} h={34} r={8}>
            <Label x={x + 12} y={y + 13} size={8} weight={700} tone="strong">
              {row.q}
            </Label>
            <Label x={x + 12} y={y + 25} size={6.6} tone="muted">
              {row.by}
            </Label>
            <Btn x={x + 262} y={y + 9} w={52} h={16} label="Draft a Page" size={6.8} />
            <path
              d={`M${x + 322} ${y + 14} l6 6 M${x + 328} ${y + 14} l-6 6`}
              className="stroke-slate-400"
              strokeWidth={1.1}
              strokeLinecap="round"
            />
          </Surface>
        );
      })}
    </Scene>
  );
}

/** One side of a disagreement: the page, its trust, the passage, and the button that says it is the right one. */
function Side({
  x,
  y,
  page,
  trust,
  lines,
  tone,
}: {
  x: number;
  y: number;
  page: string;
  trust: string;
  lines: readonly string[];
  tone: 'brand' | 'amber';
}) {
  return (
    <g>
      <Surface x={x} y={y} w={166} h={98} r={8}>
        <Label x={x + 10} y={y + 14} size={8} weight={700} tone="strong">
          {page}
        </Label>
        <Pill x={x + 10} y={y + 28} label={trust} tone={tone} size={6.4} h={11} />
        {lines.map((line, i) => (
          <Label key={line} x={x + 10} y={y + 46 + i * 11} size={6.8} tone="body">
            {line}
          </Label>
        ))}
        <Btn
          x={x + 10}
          y={y + 74}
          w={146}
          h={15}
          label={`${page} Is Right, Fix the Other`}
          size={6.4}
        />
      </Surface>
    </g>
  );
}

/** Pages That Disagree: the question both answer, the two passages side by side, and how to settle it. */
export function ConflictScene() {
  const x = 38;
  return (
    <Scene w={W} h={178} bg="plain">
      <SectionHead x={x} y={14} title="Pages That Disagree" />
      <Label x={x} y={30} size={7.5} weight={600} tone="strong">
        Which day do we deploy?
      </Label>
      <Side
        x={x}
        y={40}
        page="Deploying"
        trust="Verified 2 Mar"
        lines={['We deploy on Mondays, after', 'the checks pass.']}
        tone="brand"
      />
      <Side
        x={x + 178}
        y={40}
        page="Release Process"
        trust="Review Due"
        lines={['Releases go out every', 'Tuesday afternoon.']}
        tone="amber"
      />
      <Btn x={x} y={148} w={74} h={16} label="Ask Both Owners" size={7} />
      <Btn x={x + 80} y={148} w={70} h={16} label="Not a Conflict" variant="quiet" size={7} />
    </Scene>
  );
}

const CONTEXT = [
  { page: 'Start Here', tokens: '1,240 tokens' },
  { page: 'How We Work', tokens: '2,310 tokens' },
  { page: 'Where Things Are', tokens: '860 tokens' },
] as const;

/** Always in Context: the budget bar, each page with its size and a remove button, and Add a Page. */
export function ContextBudgetScene() {
  const x = 60;
  return (
    <Scene w={W} h={170} bg="plain">
      <SectionHead x={x} y={14} title="Always in Context" />
      <Btn x={x + 244} y={6} w={56} h={15} label="Add a Page" size={7} />
      <StackedBar
        x={x}
        y={30}
        w={300}
        h={8}
        parts={[
          { share: 4410 / 8000, className: 'fill-brand-600' },
          { share: 1 - 4410 / 8000, className: 'fill-slate-100' },
        ]}
      />
      <Label x={x} y={48} size={7} tone="muted">
        4,410 of 8,000 tokens
      </Label>
      {CONTEXT.map((row, i) => {
        const y = 60 + i * 30;
        return (
          <Surface key={row.page} x={x} y={y} w={300} h={24} r={7}>
            <Label x={x + 12} y={y + 12.4} size={8} weight={600} tone="strong">
              {row.page}
            </Label>
            <Label x={x + 262} y={y + 12.4} anchor="end" size={7} tone="muted">
              {row.tokens}
            </Label>
            <path
              d={`M${x + 280} ${y + 9} l6 6 M${x + 286} ${y + 9} l-6 6`}
              className="stroke-slate-400"
              strokeWidth={1.1}
              strokeLinecap="round"
            />
          </Surface>
        );
      })}
    </Scene>
  );
}
