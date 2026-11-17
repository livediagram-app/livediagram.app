'use client';

import { ProfileHeaderCard } from '@liveworkspace/settings-ui';
import { useAuthHrefs } from '../../chrome/auth-routes';
import { useDeferredAuth } from '../../providers/deferred-auth';

// Settings › Profile's identity card, one copy for every editor (docs/specs/007-editor/user-preferences.md; the card is
// the shared Profile's header, @liveworkspace/settings-ui ProfileHeaderCard, liveworkspace/docs/specs/010-site/site.md
// "Settings", "Profile"): the avatar, name, email and when they joined, read from the account and never written here
// (names and emails are managed on the liveworkspace accounts site, so this is a card, not a form). A guest gets the
// guest card and the way in.
//
// The avatar is the person's own Google picture over their initials, by the header's rule
// (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): their own screen always shows it, whatever
// Show My Google Picture says, since that switch only decides what others see. An editor with an own-picture store
// passes `picture` (as it does to the header's AuthControls); left out, the session's `user.picture`.
export function SettingsIdentityRow({
  row,
  things,
  picture,
}: {
  row: { key: string };
  // What the guest card calls this app's work ("canvases", "plans").
  things: string;
  picture?: string | null;
}) {
  const { authLoaded, isSignedIn, user } = useDeferredAuth();
  const { signInHref, signUpHref } = useAuthHrefs();
  return (
    <div data-settings-cell={row.key} className="rounded-[inherit]">
      {authLoaded && isSignedIn && user ? (
        <ProfileHeaderCard
          identity={{
            name: user.fullName ?? user.username ?? user.email ?? 'Your account',
            email: user.email,
            joined: user.createdAt,
            picture: picture === undefined ? user.picture : picture,
          }}
        />
      ) : (
        <ProfileHeaderCard guest={{ signInHref, signUpHref, things }} />
      )}
    </div>
  );
}
