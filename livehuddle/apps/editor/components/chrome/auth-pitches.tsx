// The pitch the Night Band frame shows beside its card on the account pages (docs/specs/014-identity/
// auth-and-guest-access.md "The look: Night Band"): what an account adds. livehuddle has no connect pages.
// Each title stands alone, as on liveworkspace.app's sign-in pitch; the shared AuthPitch draws them. Copy only.
import { Glyph } from '@livehuddle/ui';
import type { ReactNode } from 'react';
import { AuthPitch, type PitchRow } from '@liveworkspace/workbench/components/chrome/AuthPitch';

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
export const ACCOUNT_PITCH_ROWS: readonly PitchRow[] = [
  {
    tone: 'emerald',
    icon: DEVICES,
    title: 'Your spaces sync on every device',
    line: 'Start on a laptop, pick up on a phone.',
  },
  {
    tone: 'violet',
    icon: PEOPLE,
    title: 'Create and join teams',
    line: 'Share a workspace with the people you work with.',
  },
  {
    tone: 'sky',
    icon: SPARKLE,
    title: 'Use the API',
    line: 'Make a token so your scripts can build your spaces.',
  },
  {
    tone: 'amber',
    icon: PAGE,
    title: 'Still completely free',
    line: 'Every feature, for everyone. No paid tier.',
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
