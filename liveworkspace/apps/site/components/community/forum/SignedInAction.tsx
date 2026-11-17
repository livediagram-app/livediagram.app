import type { MouseEvent } from 'react';
import { Button, ButtonContent, buttonClassName } from '@liveworkspace/ui';
import { useCommunitySite } from '../client';
import { NewPostIcon } from '../shared/icons';
import type { ForumAccount } from './useForumAccount';

// The way in to writing (liveworkspace/docs/specs/007-community/community.md "Who can do what"): signed in, the button
// that does it; signed out or a guest, Sign In to <do it>, back to this very page afterwards. Nothing while the page
// is still finding out who is reading, so the button never changes under a pointer.
export function SignedInAction({
  account,
  label,
  signInLabel,
  onClick,
  size = 'cta',
}: {
  account: ForumAccount;
  label: string;
  signInLabel: string;
  /** The pressed button comes with it: New Post's popover opens from it. */
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  size?: 'md' | 'cta';
}) {
  const { links } = useCommunitySite();
  if (account.status === 'checking') {
    return (
      <span aria-hidden className={buttonClassName({ size, className: 'invisible' })}>
        {label}
      </span>
    );
  }
  if (account.status === 'out') {
    const here = `${window.location.pathname}${window.location.search}`;
    return (
      <a href={links.signIn(here)} className={buttonClassName({ size, className: 'shadow-sm' })}>
        <ButtonContent>{signInLabel}</ButtonContent>
      </a>
    );
  }
  return (
    <Button size={size} onClick={onClick} className="shadow-sm">
      <NewPostIcon size={16} aria-hidden />
      <ButtonContent>{label}</ButtonContent>
    </Button>
  );
}
