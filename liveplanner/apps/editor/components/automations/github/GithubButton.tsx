'use client';

// The Automations screen's way to its GitHub view (docs/specs/026-plan/automations.md "The GitHub view"): GitHub's
// mark and "GitHub" in the header beside New Rule, the mark alone on a phone. Drawn only where the deployment has
// liveplanner's GitHub App.

import { Button, GithubMarkIcon, Tooltip } from '@liveplanner/ui';

export const GITHUB_BUTTON_NAME = 'GitHub Connection';

export function GithubButton({ phone, onOpen }: { phone: boolean; onOpen: () => void }) {
  return (
    <Tooltip label={GITHUB_BUTTON_NAME}>
      <Button
        variant="secondary"
        size="xs"
        aria-label={GITHUB_BUTTON_NAME}
        data-github-button=""
        onClick={onOpen}
      >
        <GithubMarkIcon size={13} aria-hidden />
        {phone ? null : 'GitHub'}
      </Button>
    </Tooltip>
  );
}
