'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { HelpView } from './HelpView';
import { useTelemetryApp } from './app';
import { MetricGroups } from './MetricCards';
import { PagesView } from './PagesView';
import { SectionedView, type SectionFocus } from './SectionedView';
import { windowLabel } from './windows';

// The Pages & Help tab (docs/specs/017-telemetry/telemetry.md): how people find their way. The
// pages they read and the landing funnel, the help centre, then every guided tour's own funnel and
// the one-off prompts (the app's own, its config's `tours`). The Dashboard's Onboarding Tours stack
// sums the tours' starts.

type Props = { summary: TelemetrySummary; active: TelemetryWindowKey };

export function PagesHelpView({ summary, active, focus }: Props & { focus?: SectionFocus | null }) {
  const { tours } = useTelemetryApp();
  return (
    <SectionedView
      focus={focus}
      sections={[
        { key: 'pages', title: 'Pages', content: <PagesView summary={summary} active={active} /> },
        { key: 'help', title: 'Help', content: <HelpView summary={summary} active={active} /> },
        {
          key: 'tours',
          title: 'Tours & Prompts',
          content: (
            <>
              <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
                Each guided tour from offer to finish, then the one-off prompts, for{' '}
                <span className="font-medium">{windowLabel(active)}</span>.
              </p>
              <MetricGroups groups={tours} summary={summary} active={active} />
            </>
          ),
        },
      ]}
    />
  );
}
