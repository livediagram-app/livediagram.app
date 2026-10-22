'use client';

// The Export dialog's Photo card (docs/specs/031-photo/photo-pages.md "Exports and other views"):
// which photo page, then PNG, JPEG (quality; what shows through), WebP (quality, or Lossless), PSD
// (layers kept) or Layers as Files (a .zip of each visible layer). PNG, JPEG and WebP draw the
// elements on the page over the photo while Include Elements is on.
import { useContext, useState } from 'react';
import { Button } from '@livedesign/ui';
import type { LaidOutPage, Tab } from '@livedesign/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { loadTabImages } from '@/lib/export-tab-images';
import {
  download,
  elementsImage,
  loadedSession,
  photoFile,
  type PhotoFormat,
} from '@/lib/photo-editor/photo-export';
import { apiFetcher, PixelsStore } from '@/lib/photo-editor/pixels-store';
import { track } from '@/lib/telemetry';
import { OptionChoice, OptionSlider, OptionToggle } from './photo-controls';

const FORMATS: readonly { value: PhotoFormat; label: string; line: string }[] = [
  { value: 'png', label: 'PNG', line: 'Every pixel as it is, transparency kept.' },
  { value: 'jpeg', label: 'JPEG', line: 'Smaller, for sharing; no transparency.' },
  { value: 'webp', label: 'WebP', line: 'Small, with transparency, for the web.' },
  { value: 'psd', label: 'PSD', line: 'Its layers kept, to open in another editor.' },
  { value: 'layers', label: 'Layers as Files', line: 'A .zip of each visible layer as a PNG.' },
];

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PhotoExportPanel({
  tab,
  pages,
  documentName,
  imageContext,
  onDone,
  onBack,
}: {
  tab: Tab;
  pages: readonly LaidOutPage[];
  documentName: string;
  imageContext?: { ownerId: string; documentId: string; shareCode: string | null } | null;
  onDone: () => void;
  onBack: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const photoPages = pages.filter((p) => p.kind === 'photo');
  const editor = useContext(EditorContext);
  const live = editor?.pagesMode?.photo;
  const [pageId, setPageId] = useState(() =>
    live?.focusId && photoPages.some((p) => p.id === live.focusId)
      ? live.focusId
      : (photoPages[0]?.id ?? ''),
  );
  const [format, setFormat] = useState<PhotoFormat>('png');
  const [quality, setQuality] = useState(0.9);
  const [lossless, setLossless] = useState(false);
  const [matte, setMatte] = useState<'white' | 'black'>('white');
  const [withElements, setWithElements] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const page = photoPages.find((p) => p.id === pageId);
  const run = async () => {
    const scope = live?.scope ?? imageContext ?? null;
    if (!page || !scope) return;
    setBusy(true);
    setError(null);
    try {
      const store = live?.store ?? new PixelsStore(apiFetcher(() => scope));
      const { session, done } = await loadedSession(tab, page.id, store, live?.session ?? null);
      const flat = format === 'png' || format === 'jpeg' || format === 'webp';
      const elements =
        flat && withElements
          ? await elementsImage(tab, page, await loadTabImages(tab, scope).catch(() => undefined))
          : null;
      const file = await photoFile(
        session,
        `${documentName || 'Photo'} - ${page.name ?? 'Photo'}`,
        {
          format,
          quality,
          lossless,
          matte: matte === 'white' ? '#ffffff' : '#000000',
          elements,
        },
      );
      done();
      download(file.blob, file.name);
      track('Document', 'Exported', `Photo${format === 'layers' ? 'Layers' : pascal(format)}`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The export failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-xs font-medium text-slate-500 hover:underline"
      >
        ← All formats
      </button>
      {photoPages.length > 1 ? (
        <OptionChoice
          label="Photo Page"
          value={pageId}
          choices={photoPages.map((p) => ({ value: p.id, label: p.name ?? `Page ${p.index + 1}` }))}
          onChange={setPageId}
        />
      ) : null}
      <div role="radiogroup" aria-label="Format" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FORMATS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={format === f.value}
            onClick={() => setFormat(f.value)}
            className={`rounded-lg border p-2 text-left ${
              format === f.value
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15'
                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              {f.label}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {f.line}
            </span>
          </button>
        ))}
      </div>
      {format === 'jpeg' || format === 'webp' ? (
        <OptionSlider
          label="Quality"
          value={quality}
          min={0.01}
          max={1}
          step={0.01}
          unit="%"
          scale={100}
          width="w-full"
          onChange={setQuality}
        />
      ) : null}
      {format === 'webp' ? (
        <OptionToggle label="Lossless" on={lossless} onChange={setLossless} />
      ) : null}
      {format === 'jpeg' ? (
        <OptionChoice<'white' | 'black'>
          label="Where Transparent"
          value={matte}
          choices={[
            { value: 'white', label: 'White' },
            { value: 'black', label: 'Black' },
          ]}
          onChange={setMatte}
        />
      ) : null}
      {format === 'png' || format === 'jpeg' || format === 'webp' ? (
        <OptionToggle label="Include Elements" on={withElements} onChange={setWithElements} />
      ) : null}
      {page && live?.photos[page.id] ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {live.photos[page.id]!.width} x {live.photos[page.id]!.height} px, at its pixel size.
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
      <div className="flex justify-end">
        <Button size="sm" disabled={busy || !page} onClick={() => void run()}>
          {busy ? 'Exporting…' : 'Download'}
        </Button>
      </div>
    </div>
  );
}
