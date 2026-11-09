'use client';

import { nudgeCountdown } from '@livehuddle/api-schema';
import { Button, Tooltip } from '@livehuddle/ui';
import { useNudgeCooldown, type NudgeTarget } from '@/lib/nudge/nudge-inbox';

// A person's Nudge on their Collaborators row (docs/specs/012-collaboration/nudge.md "Nudging"). After a nudge it
// reads Nudged and waits out the 2 minutes, its tooltip counting down; aria-disabled rather than disabled, so the
// pointer still finds it and the tooltip can say how long is left. Only a cooling button ticks.
export function NudgeButton({
  target,
  onNudge,
}: {
  target: NudgeTarget;
  onNudge: (target: NudgeTarget) => void;
}) {
  const left = useNudgeCooldown(target);
  const cooling = left > 0;
  const countdown = `Nudge again in ${nudgeCountdown(left)}`;
  const label = cooling
    ? `Nudged ${target.name}, ${countdown.toLowerCase()}`
    : `Nudge ${target.name}`;
  return (
    <Tooltip label={cooling ? countdown : `Nudge ${target.name}`}>
      <Button
        variant="secondary"
        size="xs"
        aria-label={label}
        aria-disabled={cooling || undefined}
        data-nudge-button=""
        onClick={cooling ? undefined : () => onNudge(target)}
      >
        {cooling ? 'Nudged' : 'Nudge'}
      </Button>
    </Tooltip>
  );
}
