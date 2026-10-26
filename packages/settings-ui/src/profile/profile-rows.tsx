'use client';

import { useState, type ReactNode } from 'react';
import type { AccountSection } from '../account-model';
import type { SettingsRow } from '../model';
import { SETTINGS_ROW_BUTTON, SettingsRowShell } from '../SettingsRowShell';
import { ProfileHeaderCard, type AccountGuest } from './ProfileHeader';
import { ProfileSection } from './ProfileEditor';
import { SessionsRows, SignInMethodsRows } from './SecurityRows';

// The Profile category's rows (liveworkspace/docs/specs/010-site/site.md "Settings", "Profile"), grouped as the old livediagram
// Profile page was: the header card, Name and Colour, Sign-in and Security, then Your Account. Name and Colour is
// edited in place wherever the panel opens (the host's ProfileHost); only sign-in and devices, which are
// liveworkspace.app's session's, link there from elsewhere.

export const PROFILE_SECTIONS = {
  name: 'Name and Colour',
  security: 'Sign-in Methods',
  devices: 'Where You’re Signed In',
  account: 'Your Account',
} as const;

const PROFILE_KEYWORDS = 'name display colour color cursor avatar presence profile';
const SECURITY_KEYWORDS =
  'sign in sign-in login method google email code session device browser sign out security connected';

/** A row that leaves for another page (sign-in and devices, the API tokens on liveworkspace.app). */
export function linkOut(
  key: string,
  label: string,
  description: string,
  href: string,
  cta: string,
  leading?: ReactNode,
): SettingsRow {
  return {
    kind: 'custom',
    key,
    label,
    description,
    render: () => (
      <SettingsRowShell
        row={{ key, label, description }}
        leading={leading}
        control={
          <a href={href} className={SETTINGS_ROW_BUTTON}>
            {cta}
          </a>
        }
      />
    ),
  };
}

// Several cells drawn by one row, split by the card's hairline.
function Cells({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-slate-100 rounded-[inherit] dark:divide-slate-700/70">
      {children}
    </div>
  );
}

function SignOutRow({ onSignOut }: { onSignOut: NonNullable<AccountSection['onSignOut']> }) {
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  return (
    <SettingsRowShell
      row={{
        key: 'signOut',
        label: 'Sign Out',
        description: 'Sign out of liveworkspace in this browser. Your work stays in your account.',
      }}
      control={
        <button
          type="button"
          className={SETTINGS_ROW_BUTTON}
          disabled={state === 'busy'}
          onClick={async () => {
            setState('busy');
            const result = await Promise.resolve(onSignOut()).catch(() => false);
            setState(result === false ? 'failed' : 'idle');
          }}
        >
          {state === 'busy' ? 'Signing out…' : 'Sign Out'}
        </button>
      }
    >
      {state === 'failed' ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          Couldn’t sign out just now. Try again in a moment.
        </p>
      ) : null}
    </SettingsRowShell>
  );
}

/** The signed-in Profile's rows; none when the host has nothing to show. */
export function profileRows(section: AccountSection): SettingsRow[] {
  const { identity, profile, security, securityHref, onSignOut } = section;
  const rows: SettingsRow[] = [];
  if (identity) {
    rows.push({
      kind: 'custom',
      key: 'identity',
      label: identity.name,
      description: identity.email ?? '',
      keywords: 'account profile identity name email avatar joined',
      render: () => (
        <HeaderCell>
          <ProfileHeaderCard identity={identity} />
        </HeaderCell>
      ),
    });
  }
  if (profile) {
    rows.push({
      kind: 'custom',
      key: 'profile',
      label: 'Name and Colour',
      description:
        'Your display name and presence colour, as collaborators see them on your cursor, comments and avatar in every app.',
      keywords: PROFILE_KEYWORDS,
      section: PROFILE_SECTIONS.name,
      render: () => <ProfileSection host={profile} />,
    });
  }
  if (security) {
    rows.push(
      {
        kind: 'custom',
        key: 'signInMethods',
        label: 'Sign-in Methods',
        description: 'An emailed code, and Google.',
        keywords: SECURITY_KEYWORDS,
        section: PROFILE_SECTIONS.security,
        render: () => (
          <Cells>
            <SignInMethodsRows security={security} email={identity?.email ?? null} />
          </Cells>
        ),
      },
      {
        kind: 'custom',
        key: 'sessions',
        label: 'Where You’re Signed In',
        description: 'Each browser signed in to your account, and signing out of the others.',
        keywords: SECURITY_KEYWORDS,
        section: PROFILE_SECTIONS.devices,
        render: () => (
          <Cells>
            <SessionsRows security={security} />
          </Cells>
        ),
      },
    );
  } else if (securityHref) {
    rows.push({
      ...linkOut(
        'security',
        'Sign-in Methods and Devices',
        'How you sign in (an emailed code, Google) and every browser you’re signed in on, managed on liveworkspace.app.',
        securityHref,
        'Manage',
      ),
      keywords: SECURITY_KEYWORDS,
      section: PROFILE_SECTIONS.security,
    });
  }
  if (onSignOut && rows.length > 0) {
    rows.push({
      kind: 'custom',
      key: 'signOut',
      label: 'Sign Out',
      description: 'Sign out of liveworkspace in this browser.',
      keywords: 'sign out log out logout leave',
      section: PROFILE_SECTIONS.account,
      render: () => <SignOutRow onSignOut={onSignOut} />,
    });
  }
  return rows;
}

/** A guest's Profile: their header card and the way in, in place of the account's rows. */
export function guestProfileRows(guest: AccountGuest): SettingsRow[] {
  return [
    {
      kind: 'custom',
      key: 'identity',
      label: guest.name ?? 'Guest',
      description: 'Sign in to keep your work and settings on every device.',
      keywords: 'account profile guest sign in create account name colour',
      render: () => (
        <HeaderCell>
          <ProfileHeaderCard guest={guest} />
        </HeaderCell>
      ),
    },
  ];
}

// The header's cell in its card, marked as every row's cell is (the scroll memory's anchor).
function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <div data-settings-cell="identity" className="rounded-[inherit]">
      {children}
    </div>
  );
}
