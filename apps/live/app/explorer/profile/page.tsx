import type { Metadata } from 'next';
import { ProfileRedirect } from './ProfileRedirect';

// /explorer/profile is retired: everything it held (identity, the email
// notification toggles, delete account) moved into the Settings dialog
// (spec/20 + spec/65).
//
// The route SURVIVES as a redirect and must keep doing so: every notification
// email ever sent carries this URL as its "Manage your notifications" link
// AND as its List-Unsubscribe header (spec/64). Those are in people's inboxes
// forever, and an unsubscribe link that 404s is the one dead link a product
// really cannot ship.
export const metadata: Metadata = {
  title: 'Notification Settings | livediagram',
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfileRedirect />;
}
