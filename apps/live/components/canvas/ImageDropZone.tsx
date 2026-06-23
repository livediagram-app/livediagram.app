'use client';

import { useRef, useState } from 'react';
import { UPLOAD_ACCEPT_ATTR, UPLOAD_MAX_BYTES } from '@/lib/upload-image';

// Drop / click target for image uploads. The same dashed-border
// tile appeared inline in both ImagePicker (editor modal, 192px
// tall) and GalleryPane (Explorer Image Gallery, 128px tall), with
// identical drop / drag / click handlers and styling minus the
// size + gap. The component is controlled: it owns the
// drop-active visual state, but the caller drives the actual
// upload (so paste support, "deduped" toasts, and gallery
// refreshes can share one state machine per surface).
//
// Caller responsibilities:
//   - drive `uploading` + `error` so paste / drop / click share
//     one surface
//   - implement `onSelectFile` (typically a thin wrapper around
//     `uploadImageFile` from lib/upload-image)

type ImageDropZoneProps = {
  onSelectFile: (file: File) => void | Promise<void>;
  uploading: boolean;
  error: string | null;
  // Caption above the size hint. ImagePicker's modal mentions
  // paste support; GalleryPane drops the paste hint because the
  // explorer surface doesn't have a modal-scoped paste listener.
  prompt: string;
  // Tailwind height + gap. ImagePicker uses h-48 / gap-2,
  // GalleryPane h-32 / gap-1.
  heightClass?: string;
  gapClass?: string;
};

export function ImageDropZone({
  onSelectFile,
  uploading,
  error,
  prompt,
  heightClass = 'h-32',
  gapClass = 'gap-1',
}: ImageDropZoneProps) {
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropActive(false);
          const file = e.dataTransfer.files[0];
          if (file) void onSelectFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex ${heightClass} cursor-pointer flex-col items-center justify-center ${gapClass} rounded-lg border-2 border-dashed transition ${
          dropActive
            ? 'border-brand-400 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
            : 'border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10'
        }`}
      >
        <UploadIcon />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {uploading ? 'Uploading...' : prompt}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          PNG, JPEG, WebP, or GIF up to {UPLOAD_MAX_BYTES / (1024 * 1024)} MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD_ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onSelectFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {error ? (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </>
  );
}

function UploadIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-slate-500 dark:text-slate-400"
    >
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
