// The two pitches the Night Band frame shows beside its card (docs/specs/014-identity/auth-and-guest-access.md "The
// look: Night Band"): what an account adds, on the account pages, and what connecting means, on the connect pages.
// Copy only; no controls.
import { Glyph } from '@livediagram/ui';
import type { ReactNode } from 'react';
import { AuthPitch, type PitchRow } from './AuthStage';

function Icon({ children }: { children: ReactNode }) {
  return (
    <Glyph size={20} units={24}>
      {children}
    </Glyph>
  );
}

const DEVICES = (
  <Icon>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
);
const SPARKLE = (
  <Icon>
    <path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z" />
  </Icon>
);
const PEOPLE = (
  <Icon>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 19a6 6 0 0 1 12 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16 14.2a4.5 4.5 0 0 1 5 4.8" />
  </Icon>
);
const PAGE = (
  <Icon>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6" />
  </Icon>
);
const PULSE = (
  <Icon>
    <path d="M3 12h4l2-5 4 10 2-5h6" />
  </Icon>
);
const CHECK = (
  <Icon>
    <path d="M5 12l5 5 9-10" />
  </Icon>
);
const UNDO = (
  <Icon>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
  </Icon>
);

export const ACCOUNT_PITCH_ROWS: readonly PitchRow[] = [
  {
    tone: 'emerald',
    icon: DEVICES,
    lead: 'Every device',
    title: 'Your documents sync',
    line: 'Start on a laptop, pick up on a phone.',
  },
  {
    tone: 'violet',
    icon: PEOPLE,
    lead: 'Teams',
    title: 'Create and join teams',
    line: 'Share a workspace with the people you work with.',
  },
  {
    tone: 'sky',
    icon: SPARKLE,
    lead: 'AI tools',
    title: 'Connect your assistant',
    line: 'Let it find, read and draw on your boards.',
  },
  {
    tone: 'amber',
    icon: PAGE,
    lead: '0 paywalls',
    title: 'Still completely free',
    line: 'Every feature, for everyone. No paid tier.',
  },
];

export const CONNECT_PITCH_ROWS: readonly PitchRow[] = [
  {
    tone: 'emerald',
    icon: PULSE,
    lead: 'Live',
    title: 'Changes show as they happen',
    line: 'Edits land on your boards like a teammate’s.',
  },
  {
    tone: 'sky',
    icon: CHECK,
    lead: 'Your call',
    title: 'You approve every connection',
    line: 'Nothing connects until you say so here.',
  },
  {
    tone: 'amber',
    icon: UNDO,
    lead: 'Revoke',
    title: 'Access, any time',
    line: 'On liveworkspace.app, under API tokens.',
  },
];

export function AccountPitch() {
  return (
    <AuthPitch
      eyebrow="No catch"
      heading="An account is optional. Here is what it adds."
      rows={ACCOUNT_PITCH_ROWS}
    />
  );
}

export function ConnectPitch() {
  return (
    <AuthPitch
      eyebrow="Connect"
      heading="Your boards, wherever you work."
      rows={CONNECT_PITCH_ROWS}
    />
  );
}
