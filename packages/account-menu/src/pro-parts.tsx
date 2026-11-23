'use client';

import { lazy, Suspense } from 'react';
import { proOn } from '@liveworkspace/subscription-ui/flag';

// The account menu's two marks of Pro (pro-item.tsx), behind the build's flag and in a chunk of their own: the menu
// is in every site's header, so with Pro off it carries none of their code, and with Pro on it fetches them only
// once a signed-in person's menu is drawn.
const load = () => import('./pro-item');
const LazyBadge = lazy(() => load().then((m) => ({ default: m.AccountProBadge })));
const LazyItem = lazy(() => load().then((m) => ({ default: m.ProItem })));

/** Fetches the Pro parts ahead of time (a test warming its imports). */
export async function preloadProParts(): Promise<void> {
  await load();
}

/** The solid badge beside the name, for someone who has Pro. Nothing with Pro off. */
export function AccountProBadge() {
  if (!proOn()) return null;
  return (
    <Suspense fallback={null}>
      <LazyBadge />
    </Suspense>
  );
}

/** Upgrade to Pro for someone on Free (or See Pro, where the page has no provider). Nothing with Pro off. */
export function ProItem({ close }: { close: () => void }) {
  if (!proOn()) return null;
  return (
    <Suspense fallback={null}>
      <LazyItem close={close} />
    </Suspense>
  );
}
