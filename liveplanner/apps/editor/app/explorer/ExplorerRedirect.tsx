'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { explorerRedirectUrl } from '@/lib/explorer-redirect';

// Every /explorer address now opens the Explorer on liveworkspace.app (lib/explorer-redirect.ts), keeping its path,
// query and hash: a view, a folder, the Settings deep link every notification email carries. In production the
// editor worker has already sent the visitor there; this covers the dev server.
const noSubscribe = () => () => {};
const currentTarget = () => {
  const { pathname, search, hash } = window.location;
  return explorerRedirectUrl(pathname, search, hash);
};

export function ExplorerRedirect() {
  // The address to go to, read once the page is in a browser (null while prerendered).
  const target = useSyncExternalStore(noSubscribe, currentTarget, () => null);
  useEffect(() => {
    if (target) window.location.replace(target);
  }, [target]);
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
