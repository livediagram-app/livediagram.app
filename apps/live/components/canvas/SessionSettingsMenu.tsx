'use client';

// The `…` quick settings on a vote / poll session element (spec/105).
//
// A thin wrapper now. It used to carry its OWN forms — a list of dot presets
// for a vote, a hand-rolled question-and-answers form for a poll — which were
// a third design of controls the Session Studio and the element's right-click
// Session category already had, and the three had drifted apart on the answer
// cap, the control shape, and the wording.
//
// All three render `SessionElementSettings` now, so there is one UI per tool
// and nothing left to keep in step. Timer elements are the exception only in
// where the trigger lives: they have their own face (SessionTimerFace), whose
// `…` renders the very same body.

import type { SessionButtonConfig } from '@livediagram/diagram';
import {
  ElementEllipsisMenu,
  ElementMenuSettingsRow,
} from '@/components/canvas/ElementEllipsisMenu';
import { SessionElementSettings } from '@/components/canvas/SessionElementSettings';

export function SessionSettingsMenu({
  config,
  onChange,
  onOpenSettings,
}: {
  config: SessionButtonConfig;
  // Absent on a read-only surface, where the trigger is not rendered at all.
  onChange: (next: SessionButtonConfig) => void;
  /** The way out of the quick settings to the element's full menu (spec/09). */
  onOpenSettings?: () => void;
}) {
  // A timer element has its own face and its own `…` (SessionTimerFace).
  if (config.tool === 'timer') return null;
  const label =
    config.tool === 'vote'
      ? 'Dot vote options'
      : config.tool === 'stopwatch'
        ? 'Stopwatch options'
        : 'Poll options';
  return (
    <ElementEllipsisMenu label={label}>
      {(close) => (
        <>
          <SessionElementSettings config={config} onChange={onChange} onClose={close} />
          {onOpenSettings ? (
            <ElementMenuSettingsRow
              onOpen={() => {
                onOpenSettings();
                close();
              }}
            />
          ) : null}
        </>
      )}
    </ElementEllipsisMenu>
  );
}
