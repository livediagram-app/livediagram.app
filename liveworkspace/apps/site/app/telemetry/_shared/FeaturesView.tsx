'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { EditingView } from './EditingView';
import { LookAndFeelView } from './LookAndFeelView';
import { useTelemetryApp } from './app';
import { MetricGroups } from './MetricCards';
import { ModesView } from './ModesView';
import { PaletteView } from './PaletteView';
import { SectionedView, type SectionFocus } from './SectionedView';
import { SettingsView } from './SettingsView';
import { windowLabel } from './windows';

// The Features tab (docs/specs/017-telemetry/telemetry.md): what people build with, gathering what
// were five tabs until October 2026 (Editing, Palette, Modes, Look & Feel, Settings) as sections,
// plus the people tools (facilitation, or discussion and teams) and connections the Dashboard leaves
// out, which are the app's own (its config's `teamwork` and `connections`).

type Props = { summary: TelemetrySummary; active: TelemetryWindowKey };

function GroupsIntro({ text, active }: { text: string; active: TelemetryWindowKey }) {
  return (
    <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
      {text}, for <span className="font-medium">{windowLabel(active)}</span>.
    </p>
  );
}

export function FeaturesView({ summary, active, focus }: Props & { focus?: SectionFocus | null }) {
  const { modes, teamwork, connections } = useTelemetryApp();
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
        // Only an app with canvas modes (liveplanner's went with its Format and Isometric tools).
        ...(modes
          ? [
              {
                key: 'modes' as const,
                title: 'Modes',
                content: <ModesView summary={summary} active={active} />,
              },
            ]
          : []),
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
          key: teamwork.key,
          title: teamwork.title,
          content: (
            <>
              <GroupsIntro text={teamwork.intro} active={active} />
              <MetricGroups groups={teamwork.groups} summary={summary} active={active} />
            </>
          ),
        },
        {
          key: 'connections',
          title: 'Connections',
          content: (
            <>
              <GroupsIntro text={connections.intro} active={active} />
              <MetricGroups groups={connections.groups} summary={summary} active={active} />
            </>
          ),
        },
      ]}
    />
  );
}
