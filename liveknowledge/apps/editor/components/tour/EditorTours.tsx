'use client';

// The Get Started tours (docs/specs/007-editor/knowledge-tours.md): offered on the footer's Get Started button, so
// mounted with the editor. The host's chunk stays out of the first load and is in before a warm paint
// (lib/editor-deferred-code.ts); the steps' words load only at a press.
import { KnowledgeToursHost } from '@/lib/editor-deferred-code';

// The editor's tours, mounted with the editor so leaving mid-tour still runs their clean-up.
export function EditorTours() {
  return <KnowledgeToursHost />;
}
