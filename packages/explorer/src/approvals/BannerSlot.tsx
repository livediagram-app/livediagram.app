'use client';

// Where the approver's banner goes: drawn only for someone the item's approval names, its code fetched the first time
// it is, so an editor nobody asked to approve anything carries none of it.

import { lazy, Suspense } from 'react';
import { useApprovalDoor } from './door';

const Banner = lazy(() => import('./ApprovalBanner').then((m) => ({ default: m.ApprovalBanner })));

export function ApprovalBannerSlot() {
  const ctx = useApprovalDoor();
  const named = ctx?.approval?.approvers.some((a) => a.id === ctx.door.viewerId) ?? false;
  if (!named) return null;
  return (
    <Suspense fallback={null}>
      <Banner />
    </Suspense>
  );
}
