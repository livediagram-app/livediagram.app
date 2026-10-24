'use client';

import { useEffect } from 'react';
import { accountRedirect } from '@/lib/account-redirect';

// An old account address (liveworkspace/docs/site.md "Your account"): the Settings panel is opened in place now, so
// this only sends the browser on to the Explorer with the panel open on the same section. The site is static, and an
// anchor (`#notifications`) never reaches a server, so the move happens in the browser; `replace`, so Back doesn't
// come back here.
export function AccountRedirect() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    window.location.replace(accountRedirect(pathname, search, hash));
  }, []);
  return null;
}
