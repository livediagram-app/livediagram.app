'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { HelpView } from './HelpView';
import {
  AVATAR_TOUR,
  DRAW_TOUR,
  ELEMENT_TOURS,
  FACILITATE_TOUR,
  FORM_TOUR,
  PAGES_TOUR,
  NEW_VERSION_PROMPT,
  PLAN_TOUR,
  POWER_USER_OFFER,
  SHOW_ME_TOURS,
  WELCOME_TOUR,
} from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { PagesView } from './PagesView';
import { SectionedView, type SectionFocus } from './SectionedView';
import { windowLabel } from './windows';

// The Pages & Help tab (docs/specs/017-telemetry/telemetry.md): how people find their way. The
// pages they read and the landing funnel, the help centre, then every guided tour's own funnel and
// the one-off prompts. The Dashboard's Onboarding Tours stack sums the tours' starts.

export const TOURS_GROUPS: MetricGroup[] = [
  {
    title: 'Tours',
    metrics: [
      WELCOME_TOUR,
      PLAN_TOUR,
      FACILITATE_TOUR,
      DRAW_TOUR,
      FORM_TOUR,
      AVATAR_TOUR,
      PAGES_TOUR,
      ELEMENT_TOURS,
      SHOW_ME_TOURS,
    ],
  },
  { title: 'Prompts', metrics: [POWER_USER_OFFER, NEW_VERSION_PROMPT] },
];

type Props = { summary: TelemetrySummary; active: TelemetryWindowKey };

export function PagesHelpView({ summary, active, focus }: Props & { focus?: SectionFocus | null }) {
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
              <MetricGroups groups={TOURS_GROUPS} summary={summary} active={active} />
            </>
          ),
        },
      ]}
    />
  );
}
