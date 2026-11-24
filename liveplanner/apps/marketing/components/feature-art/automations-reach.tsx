// Feature illustrations for rules that reach past their own plan (liveworkspace/docs/specs/018-automations/
// automations.md "Steps in other apps", docs/specs/026-plan/automations.md "Snapshot steps"): a card's rule writing a
// knowledgebase page and posting in a Space, a weekly reset to a snapshot, and a knowledgebase's rule filing a card
// on a board. Same stage and 6s timeline as ./automations, whose step cards they reuse.
import { MUTED, Panel, Pill, RULE, Scene, TEXT, at } from './canvas-parts';
import { Step } from './automations';
import { AppMark, type AppName } from './plan-crossapp';
import { PlanCard } from './plan-parts';

/** A Then step that acts in another app: its eyebrow names the app, under that app's mark. */
function OtherAppStep({
  x,
  y,
  w,
  app,
  text,
}: {
  x: number;
  y: number;
  w: number;
  app: AppName;
  text: string;
}) {
  return (
    <g>
      <Panel x={x} y={y} w={w} h={30} />
      <AppMark x={x + 7.5} y={y + 10.5} app={app} />
      <text
        className={MUTED}
        x={x + 23}
        y={y + 12}
        fontSize="5"
        fontWeight="700"
        letterSpacing="0.5"
      >
        THEN · {app.toUpperCase()}
      </text>
      <text className={TEXT} x={x + 23} y={y + 22} fontSize="6.4" fontWeight="700">
        {text}
      </text>
    </g>
  );
}

/** Steps in other apps: a card moved to Done writes the release note page and posts in the team's Space. */
export function CrossAppStepsArt() {
  return (
    <Scene>
      <Step x={14} y={33} w={104} kind="when" text="Card moved to Done" />
      {[
        { app: 'liveknowledge' as const, text: 'Write a Page: Release notes', y: 10 },
        { app: 'livehuddle' as const, text: 'Post in a Space: #launch', y: 56 },
      ].map((s, i) => (
        <g key={s.app}>
          <path
            className="fa-a-in stroke-(--art-arrow)"
            style={at(0.3 + i * 0.3)}
            d={`M120 48C134 48 134 ${s.y + 15} 148 ${s.y + 15}`}
            fill="none"
            strokeWidth="0.9"
            strokeDasharray="2 2"
          />
          <g className="fa-a-pop" style={at(0.5 + i * 0.3)}>
            <OtherAppStep x={150} y={s.y} w={136} app={s.app} text={s.text} />
          </g>
        </g>
      ))}
    </Scene>
  );
}

/** Snapshot steps: every Monday at 9:00 the rule puts the board back to its clean snapshot, and History says so. */
export function SnapshotStepsArt() {
  return (
    <Scene>
      <Step x={14} y={8} w={128} kind="when" text="Weekly on Monday at 9:00" />
      <Step x={14} y={50} w={128} kind="then" text="Revert to Snapshot" />
      <path className="stroke-(--art-arrow)" d="M78 38v12" strokeWidth="0.9" fill="none" />
      <Panel x={156} y={8} w={130} h={80} />
      <text className={TEXT} x={164} y={21} fontSize="6.4" fontWeight="700">
        History
      </text>
      <path className={RULE} d="M162 26h118" strokeWidth="0.6" />
      <g className="fa-a-pop" style={at(0.8)}>
        <text className={TEXT} x={164} y={37} fontSize="5.8" fontWeight="600">
          Before reverting to Clean board
        </text>
        <text className={MUTED} x={164} y={45} fontSize="5">
          Automation · Weekly reset
        </text>
      </g>
      <path className={RULE} d="M162 50h118" strokeWidth="0.5" />
      <text className={TEXT} x={164} y={60} fontSize="5.8" fontWeight="600">
        Clean board
      </text>
      <text className={MUTED} x={164} y={68} fontSize="5">
        Taken by Jordan
      </text>
      <g className="fa-a-pop" style={at(1.1)}>
        <Pill x={234} y={73} w={46} label="Reverted" tone="green" />
      </g>
    </Scene>
  );
}

/** Rules elsewhere: a knowledgebase page due for review files a card for its owner on the plan's board. */
export function RulesElsewhereArt() {
  return (
    <Scene>
      <Panel x={10} y={8} w={132} h={80} />
      <AppMark x={18} y={15} app="liveknowledge" named />
      <Step x={18} y={30} w={116} kind="when" text="Review Due" />
      <text className={MUTED} x={18} y={72} fontSize="5" fontWeight="700" letterSpacing="0.5">
        THEN · LIVEPLANNER
      </text>
      <text className={TEXT} x={18} y={81} fontSize="6.2" fontWeight="700">
        Create a Card in a Plan
      </text>
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.4)}
        d="M144 48h12"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <Panel x={158} y={8} w={128} h={80} />
      <AppMark x={166} y={15} app="liveplanner" named />
      <text className={MUTED} x={166} y={36} fontSize="5.4" fontWeight="700">
        To Do
      </text>
      <PlanCard x={166} y={40} w={112} title="Write launch FAQ" id="LP-30" />
      <g className="fa-a-pop" style={at(0.8)}>
        <PlanCard x={166} y={62} w={112} title="Review Onboarding guide" id="LP-31" type="action" />
      </g>
    </Scene>
  );
}
