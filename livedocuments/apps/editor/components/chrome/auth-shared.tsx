'use client';

// Pieces shared between the sign-in (`/sign-in/`) and sign-up (`/get-started/`) pages: the card they render in,
// worn in this app's Night Band frame and account pitch, and the hand-off to the liveworkspace accounts site with the
// return-path rules (one copy for every editor, in the workbench).
import { createAuthCards } from '@liveworkspace/workbench/components/chrome/auth-cards';
import { AUTH_TITLE, AuthStage } from './AuthStage';
import { AccountPitch } from './auth-pitches';

export * from '@liveworkspace/workbench/components/chrome/auth-routes';

export const { AuthCard, RedirectingCard } = createAuthCards({
  AuthStage,
  AUTH_TITLE,
  AccountPitch,
});
