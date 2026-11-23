'use client';

import { useId } from 'react';
import { Button } from '@livediagram/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import type { EntityField, FieldRemap } from '@livediagram/document';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { EntityFieldsEditor } from '@/components/palette/EntityFieldsEditor';
import { entityFieldsHeroArt } from './EntityFieldsHeroArt';

// An entity's Fields dialog (docs/specs/009-elements/entity.md "The Fields dialog"): its fields as rows of key,
// name and type, which a 224px menu had no room for. Opened by the element menu's Fields row and by Edit Fields
// among the entity's kind tools. A centred card, a bottom sheet on a phone. Each change saves as it is made (the
// rows' own rule), so there is nothing to cancel: Done closes, and undo takes any change back.
export function EntityFieldsDialog({
  name,
  fields,
  onChange,
  onClose,
}: {
  // The entity's title, so the dialog says whose fields these are.
  name: string;
  fields: EntityField[];
  onChange: (fields: EntityField[], remap?: FieldRemap) => void;
  onClose: () => void;
}) {
  // A name or type still being typed saves when its input is left; closing by Escape, the backdrop or a swipe
  // leaves it first, so the last edit is never dropped.
  const titleId = useId();
  const close = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    onClose();
  };
  return (
    <Dialog open onClose={close} titleId={titleId} size="md" phoneSheet className="max-h-[85vh]">
      {/* The dialog hero header (dialog-hero-header.md): an entity, its first field keyed. */}
      <HeroDialogHeader
        art={entityFieldsHeroArt}
        titleId={titleId}
        title="Fields"
        subtitle={
          name.trim()
            ? `Each field of ${name.trim()}: a key, a name and a type.`
            : 'A key, a name and a type each.'
        }
        onClose={close}
        underHandle
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <EntityFieldsEditor fields={fields} onChange={onChange} />
      </div>
      <DialogFooter>
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
