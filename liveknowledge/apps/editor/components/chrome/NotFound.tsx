// The 404 card (@liveworkspace/workbench/components/chrome/NotFound), in this product's word: "Document
// not found", "New Document", "Document Archived". Only the noun is this editor's; the card is the workbench's.
import {
  NotFound as WorkbenchNotFound,
  type NotFoundProps,
} from '@liveworkspace/workbench/components/chrome/NotFound';

export function NotFound(props: Omit<NotFoundProps, 'noun'>) {
  return <WorkbenchNotFound noun="document" {...props} />;
}
