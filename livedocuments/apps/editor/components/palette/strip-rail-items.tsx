'use client';

// The strip's divider (docs/specs/007-editor/toolbar-layout.md), shared with its popovers.

export function Divider() {
  // Hairline margins on a phone, where every pixel of the strip counts.
  return (
    <span
      aria-hidden
      className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 phone:mx-px dark:bg-slate-700"
    />
  );
}
