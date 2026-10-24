'use client';

import { useEffect } from 'react';

// /account has no page of its own: it opens Settings, the account's own page (liveworkspace/docs/site.md "Your
// account"). Teams are the Explorer's. The site is static, so the move happens in the browser.
export default function Page() {
  useEffect(() => {
    window.location.replace('/account/settings');
  }, []);
  return null;
}
