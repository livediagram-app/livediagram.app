import { DesignLoading } from './DesignLoading';

// The editor's "opening" wait (docs/specs/007-editor/new-design-route.md), wherever it shows:
// the editor chunk loading after /new's handoff, and the design loading.
export function OpeningScreen() {
  return <DesignLoading stage="opening" />;
}
