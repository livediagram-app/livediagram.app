'use client';

import { COMMUNITY_HOME_PATH } from '@livediagram/api-schema';
import { ProductNavLinks as SharedLinks, type ProductNavKey } from '@liveworkspace/ui';
import { useCommunityEnabled } from './community/useCommunityEnabled';

// The Explorer footer's links to this product's surfaces (@liveworkspace/ui's ProductNavLinks), with the
// Community among them. Asks whether the Community is on as it mounts, since a host shows it only once someone
// opens it.
export function ProductNavLinks({
  current,
  className,
}: {
  current: ProductNavKey;
  className?: string;
}) {
  const communityOn = useCommunityEnabled(undefined, true);
  return (
    <SharedLinks
      current={current}
      community={communityOn ? COMMUNITY_HOME_PATH : undefined}
      className={className}
    />
  );
}

export type { ProductNavKey };
