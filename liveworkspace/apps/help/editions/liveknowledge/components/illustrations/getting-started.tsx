import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { Sparkle } from '@liveworkspace/help-site/art/parts';
import {
  AppFrame,
  Btn,
  DialogCard,
  Face,
  FormatRow,
  HAIR,
  Lines,
  PageHead,
  Pill,
  SIDEBAR_W,
  SearchBox,
  StackedBar,
  Surface,
  Tick,
  VerifiedBadge,
  type TreeRowSpec,
} from './kit';

// Getting Started's figures (liveworkspace/docs/specs/017-help/help-centre.md "Figures and card icons"): a new
// Knowledgebase on its first page, a few pages in a tree, Describe to Set Up's two steps, and Home.

const W = 420;
const H = 250;
/** Where the reading column starts inside an AppFrame with a sidebar. */
const COL = SIDEBAR_W + 34;

/** Describe to Set Up as the sidebar draws it while a Knowledgebase is empty: the button and its line, above New Page. */
function SetUpButton({ y }: { y: number }) {
  return (
    <g>
      <rect x={8} y={y} width={SIDEBAR_W - 16} height={15} rx={4} className="fill-brand-600" />
      <Sparkle cx={17} cy={y + 7.5} r={3.4} className="fill-white help-art-as-drawn" />
      <Label x={24} y={y + 7.9} size={7} weight={700} tone="onAccent">
        Describe to Set Up
      </Label>
      <Label x={9} y={y + 22} size={5.6} tone="muted">
        Tell AI what this is for and get
      </Label>
      <Label x={9} y={y + 29} size={5.6} tone="muted">
        a page structure.
      </Label>
    </g>
  );
}

/** A new Knowledgebase: one page, Start Here, with the caret in its Title, and Describe to Set Up in the sidebar. */
export function NewKnowledgebase() {
  const rows: TreeRowSpec[] = [{ label: 'Start Here', current: true }];
  return (
    <Scene w={W} h={H} bg="none">
      <AppFrame
        w={W}
        h={H}
        name="Untitled Knowledgebase"
        rows={rows}
        topRow={<FormatRow x={SIDEBAR_W} y={0} />}
        sidebarExtra={<SetUpButton y={160} />}
      >
        <Label x={COL} y={62} size={15} weight={800} className="fill-slate-300">
          Start Here
        </Label>
        {/* The caret, at the start of the Title. */}
        <rect x={COL - 2.5} y={53} width={1.2} height={17} className="fill-brand-600" />
        <Lines x={COL} y={86} widths={[150]} className="fill-slate-100" />
      </AppFrame>
    </Scene>
  );
}

/** A few pages in: a subpage open, its parent in the breadcrumb, a link to another page in the writing. */
export function FirstPages() {
  const rows: TreeRowSpec[] = [
    { label: 'Start Here' },
    { label: 'Engineering', open: true },
    { label: 'Deploying', depth: 1, current: true },
    { label: 'On-Call', depth: 1 },
    { label: 'People', open: false },
  ];
  return (
    <Scene w={W} h={H} bg="none">
      <AppFrame w={W} h={H} rows={rows} topRow={<FormatRow x={SIDEBAR_W} y={0} />}>
        <PageHead x={COL} y={42} title="Deploying" crumb="Engineering" />
        <Lines x={COL} y={76} widths={[222, 208, 148]} />
        <Label x={COL} y={110} size={9.5} weight={700} tone="strong">
          Before You Deploy
        </Label>
        <Lines x={COL} y={124} widths={[222, 96]} />
        {/* A page link, in the accent. */}
        <Label x={COL + 102} y={133.8} size={8} weight={600} className="fill-brand-700">
          On-Call
        </Label>
        <line
          x1={COL + 102}
          y1={139}
          x2={COL + 130}
          y2={139}
          className="stroke-brand-300"
          strokeWidth={HAIR}
        />
        <Lines x={COL} y={150} widths={[222, 180]} />
      </AppFrame>
    </Scene>
  );
}

/** One suggested page of the Review step: a ticked box, a title and its one line. */
function SuggestedPage({
  x,
  y,
  depth,
  title,
  line,
  ticked = true,
}: {
  x: number;
  y: number;
  depth: number;
  title: string;
  line: number;
  ticked?: boolean;
}) {
  const left = x + depth * 10;
  return (
    <g opacity={ticked ? 1 : 0.45}>
      <rect
        x={left}
        y={y - 4}
        width={8}
        height={8}
        rx={2}
        className={ticked ? 'fill-brand-600 stroke-brand-600' : 'fill-white stroke-slate-300'}
        strokeWidth={HAIR}
      />
      {ticked ? (
        <Tick cx={left + 4} cy={y} r={2.6} className="stroke-white help-art-as-drawn" />
      ) : null}
      <Label x={left + 13} y={y + 0.4} size={7.5} weight={600} tone="strong">
        {title}
      </Label>
      <rect x={left + 13} y={y + 6} width={line} height={2.6} rx={1.3} className="fill-slate-200" />
    </g>
  );
}

/** Describe to Set Up's two steps side by side: the description, then the structure to review. */
export function DescribeToSetUpSteps() {
  return (
    <Scene w={W} h={220} bg="plain">
      {/* Step 1: describe. */}
      <DialogCard x={10} y={14} w={192} h={192} title="Describe to Set Up">
        <Label x={24} y={50} size={7.5} weight={700} tone="strong">
          What Is This Knowledgebase For?
        </Label>
        <rect
          x={24}
          y={58}
          width={164}
          height={62}
          rx={5}
          className="fill-white stroke-brand-500"
          strokeWidth={1.1}
        />
        <Label x={31} y={70} size={7} tone="body">
          The engineering handbook for a
        </Label>
        <Label x={31} y={80} size={7} tone="body">
          12 person logistics startup: how
        </Label>
        <Label x={31} y={90} size={7} tone="body">
          we ship, on-call and decisions.
        </Label>
        <Pill x={24} y={134} label="Engineering Handbook" tone="slate" size={6.3} w={82} />
        <Pill x={110} y={134} label="Customer Support" tone="slate" size={6.3} w={72} />
        <Pill x={24} y={150} label="Company Handbook" tone="slate" size={6.3} w={76} />
        <Btn x={102} y={180} w={86} label="Suggest a Structure" variant="primary" size={7.2} />
        <Btn x={60} y={180} w={36} label="Cancel" size={7.2} />
      </DialogCard>
      <path
        d="M205 110 h8 m-3 -3 l3 3 l-3 3"
        className="fill-none stroke-brand-500"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Step 2: review. */}
      <DialogCard x={218} y={14} w={192} h={192} title="Describe to Set Up">
        <Label x={232} y={46} size={6.5} weight={700} tone="muted">
          KNOWLEDGEBASE NAME
        </Label>
        <rect
          x={232}
          y={52}
          width={164}
          height={14}
          rx={4}
          className="fill-white stroke-slate-200"
          strokeWidth={HAIR}
        />
        <Label x={238} y={59.4} size={7.5} tone="strong">
          Engineering Handbook
        </Label>
        <SuggestedPage x={232} y={80} depth={0} title="How We Ship" line={96} />
        <SuggestedPage x={232} y={98} depth={1} title="Deploying" line={84} />
        <SuggestedPage x={232} y={116} depth={1} title="Release Checklist" line={70} />
        <SuggestedPage x={232} y={134} depth={0} title="On-Call" line={104} />
        <SuggestedPage x={232} y={152} depth={0} title="Glossary" line={60} ticked={false} />
        <Btn x={330} y={180} w={66} label="Create 4 Pages" variant="primary" size={7.2} />
        <Btn x={282} y={180} w={42} label="Try Again" size={7.2} />
      </DialogCard>
    </Scene>
  );
}

/** A Knowledgebase's card on Home: its name, its page count and the share of its pages that are verified. */
function HomeCard({
  x,
  y,
  name,
  pages,
  percent,
}: {
  x: number;
  y: number;
  name: string;
  pages: string;
  percent: number;
}) {
  return (
    <Surface x={x} y={y} w={122} h={52} r={8}>
      <Label x={x + 10} y={y + 14} size={8.5} weight={700} tone="strong">
        {name}
      </Label>
      <Label x={x + 10} y={y + 27} size={7} tone="muted">
        {pages}
      </Label>
      <Label x={x + 112} y={y + 27} anchor="end" size={7} weight={600} className="fill-brand-700">
        {`${percent}% verified`}
      </Label>
      <StackedBar
        x={x + 10}
        y={y + 37}
        w={102}
        h={4}
        parts={[{ share: percent / 100, className: 'fill-brand-500' }]}
      />
    </Surface>
  );
}

/** Home: the question, the field that searches every Knowledgebase and asks one, the cards, and Yours to Review. */
export function HomeScene() {
  return (
    <Scene w={W} h={H} bg="plain">
      <Label x={W / 2} y={26} anchor="middle" size={14} weight={800} tone="strong">
        What do you need to know, Maya?
      </Label>
      <Surface x={70} y={42} w={280} h={26} r={9} lift>
        <SearchBox x={76} y={48} w={220} text="Search, or ask a question" keys={null} />
        <Btn x={302} y={47} w={42} label="Ask" variant="primary" />
      </Surface>
      <Label x={128} y={82} size={7} tone="muted">
        Ask goes to
      </Label>
      <Pill x={168} y={81.6} label="Team Handbook" tone="slate" size={7} />
      <Label x={248} y={82} size={7} tone="muted">
        Search looks in all of them.
      </Label>

      <Label x={22} y={106} size={9} weight={700} tone="strong">
        Knowledgebases
      </Label>
      <HomeCard x={22} y={114} name="Team Handbook" pages="64 pages" percent={92} />
      <HomeCard x={149} y={114} name="Engineering Guide" pages="31 pages" percent={74} />
      <HomeCard x={276} y={114} name="Support Answers" pages="18 pages" percent={50} />

      <Label x={22} y={188} size={9} weight={700} tone="strong">
        Yours to Review
      </Label>
      <Surface x={22} y={196} w={376} h={40} r={8}>
        <Label x={34} y={210} size={8} weight={600} tone="strong">
          Deploying
        </Label>
        <Label x={34} y={223} size={7} tone="muted">
          Engineering Guide · Review was due 12 Nov
        </Label>
        <Btn x={334} y={208} w={54} label="Still Right" />
      </Surface>
    </Scene>
  );
}

/** liveknowledge in one picture: a verified page in its tree, and Ask answering from it with a citation. */
export function KnowledgebaseAtAGlance() {
  const rows: TreeRowSpec[] = [
    { label: 'Start Here', state: 'verified' },
    { label: 'Engineering', open: true },
    { label: 'Deploying', depth: 1, current: true },
    { label: 'On-Call', depth: 1, state: 'due' },
    { label: 'People', open: false, state: 'verified' },
  ];
  return (
    <Scene w={W} h={H} bg="none">
      <AppFrame w={W} h={H} rows={rows} topRow={<FormatRow x={SIDEBAR_W} y={0} />}>
        <PageHead x={COL} y={42} title="Deploying" crumb="Engineering" />
        <VerifiedBadge x={COL} y={72} after="Review due 10 Jun" />
        <Lines x={COL} y={88} widths={[148, 140, 96]} />
      </AppFrame>
      {/* Ask, answering from the page. */}
      <Surface x={292} y={84} w={120} h={104} r={9} lift>
        <rect x={326} y={92} width={78} height={16} rx={7} className="fill-slate-800" />
        <Label
          x={365}
          y={100.4}
          anchor="middle"
          size={6.8}
          className="fill-white help-art-as-drawn"
        >
          How do we deploy?
        </Label>
        <Lines x={302} y={120} widths={[96, 100, 62]} gap={7.5} />
        <Pill x={368} y={136.6} label="1" tone="brand" size={6.5} w={12} h={10} />
        <line x1={302} y1={150} x2={402} y2={150} className="stroke-slate-100" strokeWidth={HAIR} />
        <Face cx={308} cy={162} r={4.5} initial="1" className="fill-brand-600" />
        <Label x={317} y={162.4} size={7} weight={600} tone="strong">
          Deploying
        </Label>
        <Label x={302} y={176} size={6.4} tone="muted">
          Verified 12 Mar by Maya
        </Label>
      </Surface>
    </Scene>
  );
}
