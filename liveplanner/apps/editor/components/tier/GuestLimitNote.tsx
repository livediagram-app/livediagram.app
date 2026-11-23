'use client';

// A limit met in a guest's plan: the shared note (@liveworkspace/subscription-ui/item-tier), with the same Sign In link
// the editor's prompt uses (components/chrome/SignInPrompt.tsx).

import { GuestLimitNote as SharedGuestLimitNote } from '@liveworkspace/subscription-ui/item-tier';
import { useAuthHrefs } from '@/components/chrome/auth-shared';

export function GuestLimitNote({ sentence }: { sentence: string }) {
  const { signInHref } = useAuthHrefs();
  return <SharedGuestLimitNote sentence={sentence} signInHref={signInHref} />;
}
