import { ProjectLoading } from './ProjectLoading';

// The editor's "opening" wait (docs/specs/007-editor/new-project-route.md), wherever it shows:
// the editor chunk loading after /new's handoff, and the project loading.
export function OpeningScreen() {
  return <ProjectLoading stage="opening" />;
}
