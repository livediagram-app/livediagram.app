'use client';

// The Automations screen's way to its GitHub view (docs/specs/026-plan/automations.md "The GitHub view"): GitHub's
// mark and "GitHub" in the header beside New Rule, the mark alone on a phone. Drawn only where the deployment has
// liveplanner's GitHub App.

import { Button, GithubMarkIcon } from '@liveplanner/ui';
import { ToolFooterButton } from '@liveworkspace/ui';

export const GITHUB_BUTTON_NAME = 'GitHub Connection';

export function GithubButton({
  phone,
  onOpen,
  footer = false,
}: {
  phone: boolean;
  onOpen: () => void;
  // Inside Tools: the tools' full-width secondary footer button.
  footer?: boolean;
}) {
  if (footer)
    return (
      <ToolFooterButton
        variant="secondary"
        aria-label={GITHUB_BUTTON_NAME}
        data-github-button=""
        onClick={onOpen}
      >
        <GithubMarkIcon size={13} aria-hidden />
        GitHub
      </ToolFooterButton>
    );
  return (
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
  );
}
