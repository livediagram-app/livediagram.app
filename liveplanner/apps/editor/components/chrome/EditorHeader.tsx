import { EditorHeader as SharedEditorHeader } from '@liveworkspace/workbench/components/chrome/EditorHeader';
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
  HeaderShareIcon,
  type EditorCornerActionsProps,
} from '@liveworkspace/workbench/components/chrome/EditorCornerActions';

export type { SaveStatus } from '@liveworkspace/workbench/components/chrome/EditorHeader';

// liveplanner's bar over the pages that stand in for a plan (loading, not found, a failed create): the shared
// EditorHeader (docs/specs/007-editor/editor-app.md "Header actions") with this app's logo, which goes to the
// Explorer, and its account control. The open plan has no header bar.
export function EditorHeader() {
  return (
    <SharedEditorHeader
      app="liveplanner"
      logoHref={explorerItemHref(null)}
      account={<AuthControls />}
    />
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
      copyDescription="Duplicate this plan into your own files."
      shareAction={
        formShare ? (
          <>
            <PreviewFormButton {...formShare} />
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
function PreviewFormButton({ preview, togglePreview }: FormShareHost) {
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
        className={`${CORNER_BTN} ${preview ? CORNER_ON : CORNER_TONE}`}
      >
        <Icon aria-hidden />
        <span className="phone:sr-only [[data-compact]_&]:sr-only">{label}</span>
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
