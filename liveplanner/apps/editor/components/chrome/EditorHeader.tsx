import {
  EditorHeader as SharedEditorHeader,
  HeaderShareIcon,
  headerActionTone,
  type EditorHeaderProps as SharedEditorHeaderProps,
  type EditorHeaderWords,
} from '@liveworkspace/workbench/components/chrome/EditorHeader';
import {
  HEADER_ACTION_BTN,
  HeaderGlyph,
} from '@liveworkspace/workbench/components/chrome/header-action';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';
import { HoverCard } from '@liveplanner/ui';
import { AuthControls } from '@liveworkspace/workbench/components/chrome/AuthControls';
import { useFormShareHost, type FormShareHost } from '@/lib/form-share-store';
import { lucideEye, lucidePencil } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';
import {
  CORNER_BTN,
  CORNER_ON,
  CORNER_TONE,
  EditorCornerActions,
  type EditorCornerActionsProps,
} from '@liveworkspace/workbench/components/chrome/EditorCornerActions';

export type { SaveStatus } from '@liveworkspace/workbench/components/chrome/EditorHeader';

const WORDS: EditorHeaderWords = {
  nameLabel: 'Plan name',
  renameTitle: 'Rename plan',
  copyDescription: 'Duplicate this plan into your own files.',
};

type EditorHeaderProps = Omit<
  SharedEditorHeaderProps,
  'app' | 'logoHref' | 'words' | 'name' | 'team' | 'account' | 'shareAction' | 'present'
> & {
  // The open plan's id: the logo opens the Explorer on the place that holds it
  // (liveworkspace/docs/specs/004-index/one-explorer.md "Opening from an open item").
  itemId?: string | null;
  projectName: string;
  // The plan lives in a team's shared library (docs/specs/013-workspace/team-shared-projects.md).
  teamProject?: boolean;
  // Opens the editor's Settings on its Account category (the account menu's Account item), so it doesn't navigate
  // away from the plan.
  onOpenAccount?: () => void;
};

// liveplanner's header: the shared EditorHeader (docs/specs/007-editor/editor-app.md "Header actions") with this
// app's logo, nouns and account control, and Share Form in place of Share while a form tab is open.
export function EditorHeader({
  itemId = null,
  projectName,
  teamProject = false,
  onOpenAccount,
  ...rest
}: EditorHeaderProps) {
  const formShare = useFormShareHost();
  return (
    <SharedEditorHeader
      {...rest}
      // A form tab's Share Form takes Share's place (docs/specs/030-forms/forms.md).
      shareAction={
        formShare ? (
          <>
            <PreviewFormButton {...formShare} corner={false} />
            <ShareFormButton {...formShare} />
          </>
        ) : undefined
      }
      app="liveplanner"
      logoHref={explorerItemHref(itemId)}
      words={WORDS}
      name={projectName}
      team={teamProject}
      account={<AuthControls onOpenAccount={onOpenAccount} />}
    />
  );
}

// Share Form (docs/specs/030-forms/forms.md): publishes the open form tab and copies its link, filled in brand while
// the form is published, as Share is while the plan is shared.
function ShareFormButton({ published, open }: FormShareHost) {
  return (
    <HoverCard
      title="Share Form"
      description={
        published ? 'Copy the form’s link, or close it.' : 'Publish the form and copy its link.'
      }
    >
      <button
        type="button"
        data-tour-id="share-form"
        onClick={open}
        className={`${HEADER_ACTION_BTN} ${headerActionTone(published)}`}
        aria-pressed={published}
      >
        <HeaderGlyph>
          <HeaderShareIcon />
        </HeaderGlyph>
        <span>Share Form</span>
      </button>
    </HoverCard>
  );
}

// Experiment (no header bar): the header's actions in the top-right corner card (EditorCornerActions), with Share Form
// in Share's place while a form tab is open, as the header had it.
export function PlanCornerActions(
  props: Omit<EditorCornerActionsProps, 'shareAction' | 'copyDescription'>,
) {
  const formShare = useFormShareHost();
  return (
    <EditorCornerActions
      {...props}
      copyDescription={WORDS.copyDescription}
      shareAction={
        formShare ? (
          <>
            <PreviewFormButton {...formShare} corner />
            <CornerShareFormButton {...formShare} />
          </>
        ) : undefined
      }
    />
  );
}

const EyeIcon = lucideGlyph(lucideEye, 16);
const EditIcon = lucideGlyph(lucidePencil, 16);

// Preview (docs/specs/030-forms/forms.md "Preview"), left of Share Form: the form as its link draws it, and Edit Form
// back to the builder. Filled in brand while previewing.
function PreviewFormButton({
  preview,
  togglePreview,
  corner,
}: FormShareHost & { corner: boolean }) {
  const label = preview ? 'Edit Form' : 'Preview';
  const Icon = preview ? EditIcon : EyeIcon;
  return (
    <HoverCard
      title={label}
      description={
        preview ? 'Back to building the form.' : 'See the form as people who open its link will.'
      }
    >
      <button
        type="button"
        data-tour-id="preview-form"
        onClick={togglePreview}
        aria-pressed={preview}
        className={
          corner
            ? `${CORNER_BTN} ${preview ? CORNER_ON : CORNER_TONE}`
            : `${HEADER_ACTION_BTN} ${headerActionTone(preview)}`
        }
      >
        {corner ? (
          <Icon aria-hidden />
        ) : (
          <HeaderGlyph>
            <Icon aria-hidden />
          </HeaderGlyph>
        )}
        <span className={corner ? 'phone:sr-only [[data-compact]_&]:sr-only' : undefined}>
          {label}
        </span>
      </button>
    </HoverCard>
  );
}

function CornerShareFormButton({ published, open }: FormShareHost) {
  return (
    <HoverCard
      title="Share Form"
      description={
        published ? 'Copy the form’s link, or close it.' : 'Publish the form and copy its link.'
      }
    >
      <button
        type="button"
        data-tour-id="share-form"
        onClick={open}
        aria-pressed={published}
        className={`${CORNER_BTN} ${published ? CORNER_ON : CORNER_TONE}`}
      >
        <HeaderShareIcon />
        <span className="phone:sr-only [[data-compact]_&]:sr-only">Share Form</span>
      </button>
    </HoverCard>
  );
}
