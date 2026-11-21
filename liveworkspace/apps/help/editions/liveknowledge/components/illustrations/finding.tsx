import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import {
  AppFrame,
  Btn,
  ChoiceRow,
  DialogCard,
  HAIR,
  Lines,
  Pill,
  Surface,
  TOP_H,
  Tick,
} from './kit';

// The Finding Things figures (liveworkspace/docs/specs/017-help/help-centre.md "Figures and card icons"): the search
// panel with This Knowledgebase first, the Ask view's three columns, a Knowledge Gap, and AI Settings.

const W = 420;

/** A word marked in a passage, as search marks a match. */
function Mark({ x, y, w }: { x: number; y: number; w: number }) {
  return <rect x={x} y={y - 5} width={w} height={10} rx={2} className="fill-amber-200" />;
}

/** A group's heading in the search panel. */
function GroupHead({ y, children }: { y: number; children: string }) {
  return (
    <Label x={84} y={y} size={6.2} weight={700} tone="muted">
      {children}
    </Label>
  );
}

/** The search panel on "deploy": This Knowledgebase's pages and passages first, then the rest. */
export function SearchPanelScene() {
  return (
    <Scene w={W} h={232} bg="plain">
      <Surface x={70} y={10} w={280} h={212} r={10} lift>
        {/* The field. */}
        <circle cx={88} cy={28} r={4} className="fill-none stroke-slate-400" strokeWidth={1.2} />
        <path
          d="M91 31 l3 3"
          className="stroke-slate-400"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <Label x={102} y={28.5} size={9.5} tone="strong">
          deploy
        </Label>
        <rect x={132} y={21.5} width={1.2} height={14} className="fill-brand-600" />
        <line x1={70} y1={44} x2={350} y2={44} className="stroke-slate-200" strokeWidth={HAIR} />

        <GroupHead y={56}>THIS KNOWLEDGEBASE</GroupHead>
        {/* A page whose title matches. */}
        <rect x={76} y={62} width={268} height={26} rx={5} className="fill-brand-50" />
        <Mark x={84} y={71} w={30} />
        <Label x={84} y={71.4} size={8.5} weight={700} tone="strong">
          Deploying
        </Label>
        <Tick cx={136} cy={71} r={3} className="stroke-brand-600" />
        <Label x={84} y={81.5} size={6.6} tone="muted">
          Engineering
        </Label>
        {/* A passage that matches. */}
        <Label x={84} y={99.4} size={8.5} weight={700} tone="strong">
          Release Checklist
        </Label>
        <Pill x={160} y={99} label="Due" tone="amber" size={6} w={18} h={9.5} />
        <Label x={84} y={110} size={6.6} tone="muted">
          Engineering › How We Ship
        </Label>
        <Mark x={145} y={121} w={24} />
        <Label x={84} y={121.4} size={7.2} tone="body">
          Tag the build, then deploy to staging and wait for the checks.
        </Label>

        <line x1={70} y1={133} x2={350} y2={133} className="stroke-slate-100" strokeWidth={HAIR} />
        <GroupHead y={145}>KNOWLEDGEBASES</GroupHead>
        <Label x={84} y={159.4} size={8.5} weight={600} tone="strong">
          Deployment Runbooks
        </Label>
        <Label x={336} y={159.4} anchor="end" size={6.6} tone="muted">
          Platform Team
        </Label>
        <line x1={70} y1={171} x2={350} y2={171} className="stroke-slate-100" strokeWidth={HAIR} />
        <GroupHead y={183}>HELP</GroupHead>
        <Label x={84} y={197.4} size={8.5} weight={600} tone="strong">
          Writing on a Page
        </Label>
        <Label x={336} y={197.4} anchor="end" size={6.6} tone="muted">
          Help Centre
        </Label>
      </Surface>
    </Scene>
  );
}

/** A numbered citation chip, as an answer and its source card both wear. */
function Cite({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <rect x={x} y={y - 5} width={11} height={10} rx={3} className="fill-brand-100" />
      <Label
        x={x + 5.5}
        y={y + 0.4}
        anchor="middle"
        size={6.5}
        weight={700}
        className="fill-brand-800"
      >
        {n}
      </Label>
    </g>
  );
}

/** One source card of the Sources rail: its number, its page, the passage, and who verified it. */
function SourceCard({
  y,
  n,
  title,
  meta,
  stale = false,
}: {
  y: number;
  n: number;
  title: string;
  meta: string;
  stale?: boolean;
}) {
  return (
    <g>
      <rect
        x={306}
        y={y}
        width={106}
        height={46}
        rx={6}
        className={stale ? 'fill-amber-50 stroke-amber-200' : 'fill-white stroke-slate-200'}
        strokeWidth={HAIR}
      />
      {stale ? (
        <Pill x={380} y={y + 10} label="Stale" tone="amber" size={6} w={26} h={10} />
      ) : (
        <Cite x={312} y={y + 10} n={n} />
      )}
      <Label x={stale ? 312 : 327} y={y + 10.4} size={7.2} weight={700} tone="strong">
        {title}
      </Label>
      <Lines x={312} y={y + 20} widths={[92, 70]} gap={6.5} h={3} />
      <Label x={312} y={y + 39} size={5.8} tone="muted">
        {meta}
      </Label>
    </g>
  );
}

/** The Ask view: your questions, the conversation with a cited answer, and the Sources it came from. */
export function AskScene() {
  const H = 250;
  const top = TOP_H;
  return (
    <Scene w={W} h={H} bg="none">
      <AppFrame w={W} h={H} view="ask">
        {/* Your questions. */}
        <rect x={0} y={top} width={92} height={H - 46} className="fill-slate-50" />
        <line
          x1={92}
          y1={top}
          x2={92}
          y2={H - 26}
          className="stroke-slate-200"
          strokeWidth={HAIR}
        />
        <Btn x={8} y={top + 8} w={76} h={15} label="New Question" variant="primary" size={7.2} />
        <Label x={10} y={top + 37} size={6} weight={700} tone="muted">
          TODAY
        </Label>
        <rect x={5} y={top + 43} width={82} height={14} rx={4} className="fill-brand-100" />
        <Label x={10} y={top + 50.4} size={6.8} weight={600} className="fill-brand-800">
          How do we deploy?
        </Label>
        <Label x={10} y={top + 66} size={6.8} tone="body">
          Who is on call?
        </Label>
        <Label x={10} y={top + 84} size={6} weight={700} tone="muted">
          THIS WEEK
        </Label>
        <Label x={10} y={top + 97} size={6.8} tone="body">
          Refund policy?
        </Label>

        {/* The conversation. */}
        <rect x={206} y={top + 8} width={90} height={16} rx={8} className="fill-slate-800" />
        <Label
          x={251}
          y={top + 16.4}
          anchor="middle"
          size={7.2}
          className="fill-white help-art-as-drawn"
        >
          How do we deploy?
        </Label>
        <Surface x={100} y={top + 32} w={196} h={112} r={8}>
          <Lines x={110} y={top + 43} widths={[176, 168]} gap={8} />
          <rect
            x={110}
            y={top + 59}
            width={120}
            height={3.5}
            rx={1.75}
            className="fill-slate-200"
          />
          <Cite x={234} y={top + 61} n={1} />
          <Lines x={110} y={top + 72} widths={[176]} gap={8} />
          <rect x={110} y={top + 80} width={84} height={3.5} rx={1.75} className="fill-slate-200" />
          <Cite x={198} y={top + 82} n={2} />
          <Tick cx={114} cy={top + 99} r={3} className="stroke-brand-600" />
          <Label x={121} y={top + 99.4} size={6.8} weight={600} className="fill-brand-700">
            Answered From 2 Verified Pages
          </Label>
          <line
            x1={100}
            y1={top + 110}
            x2={296}
            y2={top + 110}
            className="stroke-slate-100"
            strokeWidth={HAIR}
          />
          <Label x={110} y={top + 127} size={6.8} tone="muted">
            Helpful
          </Label>
          <Label x={140} y={top + 127} size={6.8} tone="muted">
            Not Helpful
          </Label>
          <Label x={236} y={top + 127} anchor="end" size={6.8} weight={600} tone="body">
            Copy Answer
          </Label>
          <Label x={286} y={top + 127} anchor="end" size={6.8} weight={600} tone="body">
            Save as Page
          </Label>
        </Surface>
        <rect
          x={100}
          y={top + 154}
          width={196}
          height={20}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={HAIR}
        />
        <Label x={109} y={top + 164.4} size={7.2} tone="muted">
          Ask a follow-up
        </Label>
        <circle cx={284} cy={top + 164} r={6.5} className="fill-brand-600" />
        <path
          d={`M284 ${top + 167} v-6 m-2.4 2.4 l2.4 -2.4 l2.4 2.4`}
          className="fill-none stroke-white help-art-as-drawn"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Sources. */}
        <line
          x1={300}
          y1={top}
          x2={300}
          y2={H - 26}
          className="stroke-slate-200"
          strokeWidth={HAIR}
        />
        <Label x={306} y={top + 12} size={6} weight={700} tone="muted">
          SOURCES
        </Label>
        <SourceCard y={top + 18} n={1} title="Deploying" meta="Verified 12 Mar by Maya" />
        <SourceCard y={top + 68} n={2} title="Release Checklist" meta="Verified 3 Apr by Sam" />
        <Label x={306} y={top + 126} size={6} weight={700} tone="muted">
          FOUND BUT NOT USED
        </Label>
        <SourceCard y={top + 132} n={0} title="Old Deploy Notes" meta="Review Due" stale />
      </AppFrame>
    </Scene>
  );
}

/** A Knowledgebase gap: the amber note under an answer and the Knowledge Gap card it comes with. */
export function KnowledgeGapScene() {
  return (
    <Scene w={W} h={132} bg="plain">
      <Surface x={30} y={12} w={360} h={108} r={8}>
        <Lines x={44} y={26} widths={[330, 250]} />
        <rect
          x={44}
          y={44}
          width={332}
          height={18}
          rx={5}
          className="fill-amber-50 stroke-amber-200"
          strokeWidth={HAIR}
        />
        <Label x={54} y={53.4} size={7.5} weight={600} className="fill-amber-800">
          One thing the knowledgebase does not cover.
        </Label>
        <rect
          x={44}
          y={70}
          width={332}
          height={40}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={HAIR}
        />
        <Label x={54} y={82} size={6.2} weight={700} tone="muted">
          KNOWLEDGE GAP
        </Label>
        <Label x={54} y={96} size={8} weight={600} tone="strong">
          Who approves a hotfix at the weekend?
        </Label>
        <Btn x={236} y={82} w={132} h={16} label="Draft a Page From What We Know" size={6.8} />
      </Surface>
    </Scene>
  );
}

/** AI Settings: the provider, the key's state with Replace and Remove, and the model. */
export function AiSettingsScene() {
  return (
    <Scene w={W} h={248} bg="plain">
      <DialogCard
        x={70}
        y={10}
        w={280}
        h={228}
        title="AI Settings"
        line="Ask, AI Knowledge and Describe to Set Up run on your team's own AI key."
      >
        <Label x={84} y={52} size={6.5} weight={700} tone="muted">
          PROVIDER
        </Label>
        <ChoiceRow x={84} y={58} w={252} h={18} label="Anthropic (Claude)" chosen />
        <ChoiceRow x={84} y={80} w={252} h={18} label="OpenAI" />

        <Label x={84} y={112} size={6.5} weight={700} tone="muted">
          CLAUDE API KEY
        </Label>
        <circle cx={92} cy={127} r={6} className="fill-brand-100" />
        <circle cx={90.5} cy={127} r={1.8} className="fill-none stroke-brand-700" strokeWidth={1} />
        <path
          d="M92.3 127 h3.4 m-1.2 0 v1.6"
          className="fill-none stroke-brand-700"
          strokeWidth={1}
        />
        <Label x={104} y={127.4} size={8} weight={700} tone="strong">
          Key Ending 4f2a
        </Label>
        <Btn x={298} y={120} w={38} h={14} label="Remove" size={7} />
        <rect
          x={84}
          y={140}
          width={206}
          height={16}
          rx={4}
          className="fill-white stroke-slate-200"
          strokeWidth={HAIR}
        />
        <Label x={91} y={148.4} size={7.5} tone="muted">
          sk-ant-...
        </Label>
        <Btn x={296} y={140} w={40} h={16} label="Replace" size={7.2} />
        <Label x={84} y={167} size={6.2} tone="muted">
          The key is encrypted when it is saved and is never shown again.
        </Label>
        <Label x={84} y={176} size={6.2} tone="muted">
          liveknowledge pays for no model: your team pays Anthropic for what it uses.
        </Label>

        <Label x={84} y={194} size={6.5} weight={700} tone="muted">
          MODEL
        </Label>
        <rect
          x={84}
          y={200}
          width={150}
          height={16}
          rx={4}
          className="fill-white stroke-slate-300"
          strokeWidth={HAIR}
        />
        <Label x={91} y={208.4} size={7.5} tone="strong">
          The most capable model
        </Label>
        <path
          d="M222 206.8 l2.4 2.6 l2.4 -2.6"
          className="fill-none stroke-slate-400"
          strokeWidth={1.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </DialogCard>
    </Scene>
  );
}
