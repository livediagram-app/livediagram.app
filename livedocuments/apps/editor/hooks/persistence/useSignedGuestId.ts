'use client';

// A guest's id, from liveworkspace's guest token (@liveworkspace/workbench/hooks/persistence/useSignedGuestId).
import { createSignedGuestId } from '@liveworkspace/workbench/hooks/persistence/useSignedGuestId';
import { ensureGuestIdentity } from '@/lib/guest-identity';

export const useSignedGuestId = createSignedGuestId(() => ensureGuestIdentity());
