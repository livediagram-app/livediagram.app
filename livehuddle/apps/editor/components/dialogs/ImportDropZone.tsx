import { useState } from 'react';

/**
 * The drop area every file import's pick step shares: a large dashed target that opens the picker
 * when pressed and takes a drop, then the step's error, announced. The host reads what was dropped.
 */
export function ImportDropZone({
  label,
  onChoose,
  onDropData,
  error,
}: {
  label: string;
  onChoose: () => void;
  onDropData: (data: DataTransfer) => void;
  error?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={onChoose}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onDropData(e.dataTransfer);
        }}
        className={`flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed text-sm text-slate-600 transition focus:ring-2 focus:ring-brand-300 focus:outline-none dark:text-slate-300 ${over ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-500/10' : 'border-slate-300 dark:border-slate-600'}`}
      >
        {label}
      </button>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
