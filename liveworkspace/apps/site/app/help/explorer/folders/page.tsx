import { ExplorerHelpPage, explorerHelpMetadata } from '@/components/help/ExplorerHelpPage';

export const metadata = explorerHelpMetadata('folders');

export default function Page() {
  return <ExplorerHelpPage slug="folders" />;
}
