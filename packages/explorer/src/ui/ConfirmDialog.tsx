import { Button } from './Button';
import { Dialog } from './Dialog';

// A short yes-or-no question before something that cannot be undone (emptying the Trash, deleting a folder).
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog onClose={onCancel} ariaLabel={title} size="sm">
      <div className="px-6 pb-4 pt-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
          {message}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
