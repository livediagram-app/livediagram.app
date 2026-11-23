import type { Metadata } from 'next';
import { AccountPage } from '@/components/account/AccountPage';
import { McpConsent } from '@/components/account/McpConsent';
import { ACCOUNT_PAGE_METADATA } from '@/lib/account-metadata';

// The one MCP's consent page (liveworkspace/docs/specs/021-mcp/mcp.md): linked from nowhere and never indexed while
// the one MCP is tried.
export const metadata: Metadata = {
  ...ACCOUNT_PAGE_METADATA,
  title: 'Connect an AI tool · liveworkspace',
};

export default function Page() {
  return (
    <AccountPage>
      <McpConsent />
    </AccountPage>
  );
}
