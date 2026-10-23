import type { Metadata } from 'next';
import { ProfileRedirect } from './ProfileRedirect';

// /explorer/profile is retired: what it held (identity, the email notification switches, delete account) is in
// Settings (docs/specs/007-editor/user-preferences.md, docs/specs/014-identity/profile-and-email-notifications.md).
//
// The route must stay, as a redirect: every notification email ever sent carries it as its "Manage your
// notifications" link and its List-Unsubscribe header (docs/specs/014-identity/transactional-email.md). Those stay in
// people's inboxes for good, and an unsubscribe link that leads nowhere is the one dead link a product cannot ship.
export const metadata: Metadata = {
  title: 'Notification Settings | liveplanner',
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfileRedirect />;
}
