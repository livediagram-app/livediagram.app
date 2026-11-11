'use client';

import type { ReactNode } from 'react';
import { SegmentedToggle } from './SegmentedToggle';

/** Which apps a page shows: the one it was opened from, or every app. */
export type AppScope = 'app' | 'all';

/** One side of the switch: its words, its logo and what its hover card says. */
export type AppScopeOption = {
  label: string;
  // The product's logo mark (an app's prism, or liveworkspace's for every app), drawn at 16px.
  logo?: ReactNode;
  // The hover card's line under the label: what the side shows.
  description: string;
};

// The "this app or All Apps" switch (liveworkspace/docs/specs/010-site/site.md "The Explorer", Which app; "The Community",
// Which posts): two segments, the app's own name and All Apps, each with its logo and a hover card naming what it
// shows. The Explorer's pane header and the Community page both draw it, so the two scopes look and read the same.
export function AppScopeToggle({
  value,
  onChange,
  app,
  all,
  className = '',
}: {
  value: AppScope;
  onChange: (next: AppScope) => void;
  app: AppScopeOption;
  all: AppScopeOption;
  className?: string;
}) {
  return (
    <SegmentedToggle
      label="Show"
      value={value}
      onChange={onChange}
      options={[
        { value: 'app', ...app },
        { value: 'all', ...all },
      ]}
      className={className}
    />
  );
}
