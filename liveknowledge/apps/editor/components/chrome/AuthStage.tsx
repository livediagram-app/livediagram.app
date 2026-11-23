'use client';

import { Brand } from '@liveknowledge/ui';
import { createAuthStage } from '@liveworkspace/workbench/components/chrome/AuthStage';

// The Night Band frame every account and connect page stands on (docs/specs/014-identity/auth-and-guest-access.md
// "The look: Night Band"), shared by the editors and bound to this one's brand.
export const AuthStage = createAuthStage({ Brand });
