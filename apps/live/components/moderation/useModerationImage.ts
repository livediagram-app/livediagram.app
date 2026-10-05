'use client';

import { useEffect, useState } from 'react';
import { apiFetchCommunityImage } from '@/lib/api-client';

// A post's card image on the Moderation page (docs/specs/025-community/community.md "Reports and
// moderation"), fetched with the operator's session so a hidden post's image shows too, and held as an
// object URL that is released when the card goes. Null while loading, or when there is no image.
export function useModerationImage(ownerId: string | null, shareCode: string): string | null {
  const [loaded, setLoaded] = useState<{ key: string; url: string | null } | null>(null);
  const key = `${ownerId ?? ''}:${shareCode}`;

  useEffect(() => {
    if (!ownerId) return;
    let url: string | null = null;
    let cancelled = false;
    apiFetchCommunityImage(ownerId, shareCode)
      .then((blob) => {
        if (cancelled) return;
        url = blob ? URL.createObjectURL(blob) : null;
        setLoaded({ key, url });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.warn('[moderation] image load failed', err);
        setLoaded({ key, url: null });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, ownerId, shareCode]);

  return loaded && loaded.key === key ? loaded.url : null;
}
