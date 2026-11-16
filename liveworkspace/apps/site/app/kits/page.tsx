import type { Metadata } from 'next';
import { KitsPage } from '@/components/kits/KitsPage';

// Start a Project (liveworkspace/docs/specs/010-site/site.md "Start a Project"): a project kit, made across the apps in
// one click. Static; the page asks the index with the workspace token. A signed-in tool, so not indexed.
export const metadata: Metadata = {
  title: 'Start a Project · liveworkspace',
  robots: { index: false },
};

export default function Page() {
  return <KitsPage />;
}
