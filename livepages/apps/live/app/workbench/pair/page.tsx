import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OauthShell } from '../../oauth/oauth-shell';
import { PairWorkbench } from './PairWorkbench';

// The pairing page (docs/specs/013-workspace/workbench-embeds.md "Pairing"): a static route; the code arrives
// client-side as `?code=`. Never framed: the live worker keeps `X-Frame-Options: DENY` here.
export const metadata: Metadata = {
  title: 'Allow a workbench | livediagram',
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <OauthShell>
          <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
            Loading…
          </p>
        </OauthShell>
      }
    >
      <PairWorkbench />
    </Suspense>
  );
}
