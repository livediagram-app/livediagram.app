'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livedocuments/api-schema';
import { EditingView } from './EditingView';
import { LookAndFeelView } from './LookAndFeelView';
import {
  AGENT_CHANGESETS,
  API_TOKEN_ACTIVITY,
  DISCUSSION,
  TEAM_ACTIVITY,
} from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { ModesView } from './ModesView';
import { PaletteView } from './PaletteView';
import { SectionedView, type SectionFocus } from './SectionedView';
import { SettingsView } from './SettingsView';
import { windowLabel } from './windows';

// The Features tab (docs/specs/017-telemetry/telemetry.md): what people build with, gathering what
// were five tabs until October 2026 (Editing, Palette, Modes, Look & Feel, Settings) as sections,
// plus the discussion, teams and connections the Dashboard leaves out.

export const TEAMWORK_GROUPS: MetricGroup[] = [
  {
    title: 'Discussion and teams',
    metrics: [DISCUSSION, TEAM_ACTIVITY],
  },
];

export const CONNECTIONS_GROUPS: MetricGroup[] = [
  { title: 'Connections', metrics: [API_TOKEN_ACTIVITY, AGENT_CHANGESETS] },
];

type Props = { summary: TelemetrySummary; active: TelemetryWindowKey };

function GroupsIntro({ text, active }: { text: string; active: TelemetryWindowKey }) {
  return (
    <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
      {text}, for <span className="font-medium">{windowLabel(active)}</span>.
    </p>
  );
}

export function FeaturesView({ summary, active, focus }: Props & { focus?: SectionFocus | null }) {
  return (
    <SectionedView
      focus={focus}
      sections={[
        {
          key: 'editing',
          title: 'Editing',
          content: <EditingView summary={summary} active={active} />,
        },
        {
          key: 'palette',
          title: 'Palette',
          content: <PaletteView summary={summary} active={active} />,
        },
        { key: 'modes', title: 'Modes', content: <ModesView summary={summary} active={active} /> },
        {
          key: 'lookfeel',
          title: 'Look & Feel',
          content: <LookAndFeelView summary={summary} active={active} />,
        },
        {
          key: 'settings',
          title: 'Settings',
          content: <SettingsView summary={summary} active={active} />,
        },
        {
          key: 'teamwork',
          title: 'Discussion & Teams',
          content: (
            <>
              <GroupsIntro
                text="Comments and teams, beside the presenting on the Dashboard"
                active={active}
              />
              <MetricGroups groups={TEAMWORK_GROUPS} summary={summary} active={active} />
            </>
          ),
        },
        {
          key: 'connections',
          title: 'Connections',
          content: (
            <>
              <GroupsIntro
                text="API tokens and agent changes, beside the MCP and CLI on the Dashboard"
                active={active}
              />
              <MetricGroups groups={CONNECTIONS_GROUPS} summary={summary} active={active} />
            </>
          ),
        },
      ]}
    />
  );
}
