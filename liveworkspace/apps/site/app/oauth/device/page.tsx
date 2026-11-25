import type { Metadata } from 'next';
import { AccountPage } from '@/components/account/AccountPage';
import { McpDevice } from '@/components/account/McpDevice';
import { ACCOUNT_PAGE_METADATA } from '@/lib/account-metadata';

// An app's CLI signing in from a machine without a browser (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold
// in"): the terminal shows a code, the one MCP sends the person here. Never indexed.
export const metadata: Metadata = {
  ...ACCOUNT_PAGE_METADATA,
  title: 'Connect a terminal · liveworkspace',
};

export default function Page() {
  return (
    <AccountPage>
      <McpDevice />
    </AccountPage>
  );
}
