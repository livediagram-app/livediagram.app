// Live poll scenes for the Collaboration › Session Tools articles (docs/specs/018-help/help-app.md),
// drawn from the live editor's PollPromptSheet and PollPanel (apps/live/components/panels). Labels
// are the real UI strings.

import { Label, Panel, Scene, Shape } from './primitives';

/** What everyone is asked: the sheet that rises from the bottom of the screen, with the canvas
 *  still live behind it. */
export function PollPromptSheet() {
  const answers = ['Search', 'Onboarding', 'Billing'];
  return (
    <Scene w={420} h={236}>
      <Shape x={40} y={26} w={96} h={44} kind="rect" label="Search" />
      <Shape x={162} y={26} w={96} h={44} kind="rect" label="Onboarding" />
      <Shape x={284} y={26} w={96} h={44} kind="rect" label="Billing" />
      {/* The sheet */}
      <rect
        x={40}
        y={92}
        width={340}
        height={140}
        rx={14}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <rect x={194} y={99} width={32} height={4} rx={2} className="fill-slate-300" />
      <Label x={58} y={120} size={10} weight={700} tone="accent">
        Quick poll
      </Label>
      <Label x={58} y={140} size={13} weight={700} tone="strong">
        What should we tackle first?
      </Label>
      {answers.map((a, i) => (
        <g key={a}>
          <rect
            x={58 + i * 104}
            y={156}
            width={96}
            height={28}
            rx={8}
            className="fill-white stroke-slate-300"
            strokeWidth={1.5}
          />
          <Label x={106 + i * 104} y={171} anchor="middle" size={11} weight={600} tone="body">
            {a}
          </Label>
        </g>
      ))}
      <Label x={58} y={209} size={10} tone="muted">
        Answers aren&apos;t shown against names.
      </Label>
      <Label x={362} y={209} anchor="end" size={11} weight={600} tone="body">
        Skip
      </Label>
    </Scene>
  );
}

/** The host's Poll panel: the question, a bar per answer, the answered / skipped count, and Keep
 *  Results above End Poll. */
export function PollResultsPanel() {
  const rows = [
    { label: 'Search', count: 4, share: 0.57 },
    { label: 'Onboarding', count: 2, share: 0.29 },
    { label: 'Billing', count: 1, share: 0.14 },
  ];
  const x = 110;
  const w = 200;
  return (
    <Scene w={420} h={262} bg="plain">
      <Panel x={x} y={10} w={w} h={244} title="Poll">
        <Label x={x + 14} y={46} size={11} weight={700} tone="strong">
          What should we tackle first?
        </Label>
        {rows.map((r, i) => {
          const ry = 66 + i * 36;
          return (
            <g key={r.label}>
              <Label x={x + 14} y={ry} size={10} weight={500} tone="body">
                {r.label}
              </Label>
              <Label x={x + w - 14} y={ry} anchor="end" size={10} weight={700} tone="strong">
                {r.count}
              </Label>
              <rect
                x={x + 14}
                y={ry + 9}
                width={w - 28}
                height={7}
                rx={3.5}
                className="fill-slate-100"
              />
              <rect
                x={x + 14}
                y={ry + 9}
                width={(w - 28) * r.share}
                height={7}
                rx={3.5}
                className="fill-brand-500"
              />
            </g>
          );
        })}
        <Label x={x + 14} y={180} size={10} tone="muted">
          7 answered · 1 skipped
        </Label>
        <rect x={x + 14} y={192} width={w - 28} height={24} rx={7} className="fill-brand-500" />
        <Label x={x + w / 2} y={205} anchor="middle" size={11} weight={600} tone="onAccent">
          Keep Results
        </Label>
        <rect
          x={x + 14}
          y={222}
          width={w - 28}
          height={24}
          rx={7}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={x + w / 2} y={235} anchor="middle" size={11} weight={600} tone="body">
          End Poll
        </Label>
      </Panel>
    </Scene>
  );
}
