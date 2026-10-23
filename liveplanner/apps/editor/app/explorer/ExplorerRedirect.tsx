'use client';

import { useEffect, useState } from 'react';
import { explorerRedirectUrl } from '@/lib/explorer-redirect';

// Every /explorer address now opens the Explorer on liveworkspace.app (lib/explorer-redirect.ts), keeping its path,
// query and hash: a view, a folder, the Settings deep link every notification email carries. In production the
// editor worker has already sent the visitor there; this covers the dev server.
export function ExplorerRedirect() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const to = explorerRedirectUrl(pathname, search, hash);
    setTarget(to);
    window.location.replace(to);
  }, []);
  return (
    <p role="status" className="m-auto p-8 text-center text-sm text-slate-500 dark:text-slate-400">
      Opening your Explorer on liveworkspace…{' '}
      {target ? (
        <a href={target} className="font-medium text-brand-700 underline dark:text-brand-300">
          Continue
        </a>
      ) : null}
    </p>
  );
}
