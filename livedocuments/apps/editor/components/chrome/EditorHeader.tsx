import {
  EditorHeader as SharedEditorHeader,
  type EditorHeaderProps as SharedEditorHeaderProps,
  type EditorHeaderWords,
} from '@liveworkspace/workbench/components/chrome/EditorHeader';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';
import { AuthControls } from '@/components/chrome/AuthControls';
import { EXPLORER_LANDING_PATH } from '@/lib/explorer-landing';

export type { SaveStatus } from '@liveworkspace/workbench/components/chrome/EditorHeader';

const WORDS: EditorHeaderWords = {
  nameLabel: 'Document name',
  renameTitle: 'Rename document',
  copyDescription: 'Duplicate this document into your own files.',
  presentLead: 'Present this tab',
};

type EditorHeaderProps = Omit<
  SharedEditorHeaderProps,
  'app' | 'logoHref' | 'words' | 'name' | 'team' | 'account' | 'shareAction'
> & {
  // The open document's id: the logo opens the Explorer on the place that holds it
  // (liveworkspace/docs/specs/004-index/one-explorer.md "Opening from an open item").
  itemId?: string | null;
  documentName: string;
  // The document lives in a team's shared library (docs/specs/013-workspace/team-shared-documents.md).
  teamDocument?: boolean;
  // Opens the editor's Settings on its Account category (the account menu's Account item), so it doesn't navigate
  // away from the document.
  onOpenAccount?: () => void;
};

// livedocuments' header: the shared EditorHeader (docs/specs/007-editor/editor-app.md "Header actions") with this
// app's logo, nouns and account control, the logo landing on the Explorer's Home with no open document, and the
// Present button while the tab has a presentable page.
export function EditorHeader({
  itemId = null,
  documentName,
  teamDocument = false,
  onOpenAccount,
  ...rest
}: EditorHeaderProps) {
  return (
    <SharedEditorHeader
      {...rest}
      app="livedocuments"
      logoHref={itemId ? explorerItemHref(itemId) : EXPLORER_LANDING_PATH}
      words={WORDS}
      name={documentName}
      team={teamDocument}
      account={<AuthControls onOpenAccount={onOpenAccount} />}
    />
  );
}
