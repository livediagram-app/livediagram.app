'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { ExceptionsView } from './ExceptionsView';
import { SectionedView, type SectionFocus } from './SectionedView';
import { TimingsView } from './TimingsView';

// The Health tab (docs/specs/017-telemetry/telemetry.md): what failed, then how fast it all is. The
// Exceptions and Timings tabs until October 2026, now sections of one.

type Props = { summary: TelemetrySummary; active: TelemetryWindowKey };

export function HealthView({ summary, active, focus }: Props & { focus?: SectionFocus | null }) {
  return (
    <SectionedView
      focus={focus}
      sections={[
        {
          key: 'exceptions',
          title: 'Exceptions',
          content: <ExceptionsView summary={summary} active={active} />,
        },
        {
          key: 'timings',
          title: 'Timings',
          content: <TimingsView summary={summary} active={active} />,
        },
      ]}
    />
  );
}
