'use client';

// Where Describe Structure's dialog is drawn (docs/specs/030-knowledgebase/describe-to-set-up.md "Describe Structure
// on a page"): once, beside Describe to Set Up's, and only while it is open. Its code is one chunk fetched on the
// first open, inside an error area of its own, so none of it is in the editor's first bundle and a crash in it leaves
// the editor standing. It closes when its page is no longer the one open, or may no longer be edited.
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import {
  closeDescribeStructure,
  useDescribeStructureOpen,
} from '@/lib/describe-structure/structure-open';

const DescribeStructureDialog = dynamic(
  () => import('./DescribeStructureDialog').then((m) => m.DescribeStructureDialog),
  { ssr: false },
);

export function DescribeStructureWhenOpen() {
  const tabId = useDescribeStructureOpen();
  useEffect(() => closeDescribeStructure, []);
  // Closed, the host reads nothing of the chrome: a typing commit never reaches it.
  return tabId ? <DescribeStructureOpen tabId={tabId} /> : null;
}

function DescribeStructureOpen({ tabId }: { tabId: string }) {
  const here = useEditorChrome((s) => s.pageTab.id);
  const mayEdit = useEditorChrome((s) => s.pageEditing.mayEdit);
  const away = tabId !== here || !mayEdit;
  useEffect(() => {
    if (away) closeDescribeStructure();
  }, [away]);
  if (away) return null;
  return (
    <AreaErrorBoundary area="Modals" fallback="none">
      <DescribeStructureDialog tabId={tabId} onClose={closeDescribeStructure} />
    </AreaErrorBoundary>
  );
}
