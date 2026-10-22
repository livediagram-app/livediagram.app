'use client';

import { useEffect } from 'react';

// /account has no page of its own: it opens the teams, the page most people come for. The site is
// static, so the move happens in the browser.
export default function Page() {
  useEffect(() => {
    window.location.replace('/account/teams');
  }, []);
  return null;
}
