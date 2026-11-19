import { ExplorerHelpPage, explorerHelpMetadata } from '@/components/help/ExplorerHelpPage';

export const metadata = explorerHelpMetadata('teams');

export default function Page() {
  return <ExplorerHelpPage slug="teams" />;
}
