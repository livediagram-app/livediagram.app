import { DocumentLoading } from './DocumentLoading';

// The editor's "opening" wait (docs/specs/007-editor/new-document-route.md), wherever it shows:
// the editor chunk loading after /new's handoff, and the document loading.
export function OpeningScreen() {
  return <DocumentLoading stage="opening" />;
}
