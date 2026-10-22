import type { Metadata } from 'next';
import { AccountShell } from '@/components/settings/AccountShell';
import { TokensPanel } from '@/components/settings/TokensPanel';

export const metadata: Metadata = {
  title: 'API tokens · liveworkspace',
  robots: { index: false },
  alternates: { canonical: '/account/tokens' },
};

export default function Page() {
  return (
    <AccountShell
      path="/account/tokens"
      intro="One token works on every app’s API and MCP server. Make one for a script, or connect an AI tool from any app, and revoke either here."
    >
      <TokensPanel />
    </AccountShell>
  );
}
