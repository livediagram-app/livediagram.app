import { lucideCircleAlert } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';

const AlertIcon = lucideGlyph(lucideCircleAlert, 14);

// One field's validation message in the publish dialog, directly under the field it is about. The field
// points at it with `aria-describedby` and carries `aria-invalid`, so a screen reader reads the message
// when focus lands there.
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="flex items-start gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-300"
    >
      <AlertIcon aria-hidden className="mt-px shrink-0" />
      {message}
    </p>
  );
}
