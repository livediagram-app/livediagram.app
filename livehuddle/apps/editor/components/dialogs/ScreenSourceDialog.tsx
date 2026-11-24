'use client';

// Show on the Screen (docs/specs/009-elements/screen-and-room-sign.md "Choosing what it shows"): an Editor chooses
// what a Screen shows. A dialog centred on screen under the Embed File art, with two sources in a switch, File first:
// File is Embed File's chooser (a pasted share link, Find a File across the apps, Recent), with no role and no
// snapshot, as livehuddle has no connected tabs and a Screen keeps no picture; Video is the Video Link. Choosing
// writes the Screen's source through one patch (setScreenSourceOf), which reaches everyone in the Space at once.
import { useEffect, useId, useState } from 'react';
import type { ScreenSource } from '@livehuddle/document';
import { Button, SegmentedToggle, lucideGlyph } from '@livehuddle/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { liveEmbedPickerHeroArt } from '@liveworkspace/ui/dialog-hero-art/live-embed-picker';
import { lucideLink } from '@liveworkspace/icons/lucide';
import type { IndexClient } from '@liveworkspace/index-client';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { LiveEmbedChooser } from '@liveworkspace/workbench/components/live-embed/LiveEmbedChooser';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import {
  closeScreenPicker,
  useScreenPicker,
  type ScreenPickerTab,
} from '@/lib/office/screen-picker-store';
import { isScreenLink, normalisedScreenLink } from '@/lib/screen-link';
import { track } from '@/lib/telemetry';
import { screenWords as words } from '@/components/canvas/collab/screen-words';

const LinkGlyph = lucideGlyph(lucideLink, 15);

type Client = Pick<IndexClient, 'listItems' | 'getItem' | 'resolveShare'>;

/** Draws Show on the Screen while the store holds a Screen an Editor may change; anything else closes it. */
export function ScreenSourceDialogHost() {
  const open = useScreenPicker();
  const { activeTab, documentId, can, setScreenSourceOf } = useEditorContext();
  const screen = open
    ? activeTab.elements.find(
        (el) => el.id === open.elementId && el.type === 'shape' && el.shape === 'screen',
      )
    : undefined;
  const valid = !!screen && can.level === 'edit';
  // Its Screen deleted, or the role taken away while it was open: it closes, rather than reopening by itself later.
  useEffect(() => {
    if (open && !valid) closeScreenPicker();
  }, [open, valid]);
  if (!open || !valid) return null;
  return (
    <ScreenSourceDialog
      key={open.elementId}
      initialTab={open.tab}
      hostId={documentId ?? ''}
      savedUrl={screen.type === 'shape' ? (screen.screenUrl ?? '') : ''}
      onChoose={(source) => setScreenSourceOf(open.elementId, source)}
      onClose={closeScreenPicker}
    />
  );
}

export function ScreenSourceDialog({
  initialTab,
  hostId,
  savedUrl,
  onChoose,
  onClose,
  client = indexClient,
}: {
  initialTab: ScreenPickerTab;
  // This Space's own id: never listed.
  hostId: string;
  // The Video Link the Screen has now, to start the field from.
  savedUrl: string;
  onChoose: (source: ScreenSource) => void;
  onClose: () => void;
  client?: Client;
}) {
  const titleId = useId();
  const [tab, setTab] = useState<ScreenPickerTab>(initialTab);
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="lg" className="max-h-[90vh]">
      <HeroDialogHeader
        art={liveEmbedPickerHeroArt}
        titleId={titleId}
        title={words.dialogTitle}
        subtitle={words.dialogSubtitle}
        onClose={onClose}
      />
      <div className="px-6 pt-4">
        <SegmentedToggle
          label="Source"
          value={tab}
          onChange={setTab}
          options={[
            {
              value: 'file',
              label: words.file,
              description: 'A canvas, plan, document, design or knowledgebase, live',
            },
            { value: 'video', label: words.video, description: 'A YouTube, Vimeo or Loom link' },
          ]}
        />
      </div>
      {/* One height for both sources, so switching never jumps the dialog. */}
      <div data-screen-source-tab={tab} className="flex min-h-[26rem] flex-1 flex-col">
        {tab === 'file' ? (
          <LiveEmbedChooser
            client={client}
            hostId={hostId}
            connectedIds={[]}
            poster={false}
            onChoose={(choice) => {
              track('Element', 'Added', 'LiveEmbed');
              onChoose({ kind: 'file', liveItem: choice.liveItem, liveName: choice.liveName });
            }}
            onClose={onClose}
          />
        ) : (
          <VideoLink
            saved={savedUrl}
            onSet={(url) => {
              onChoose({ kind: 'video', url });
              onClose();
            }}
          />
        )}
      </div>
    </Dialog>
  );
}

function VideoLink({ saved, onSet }: { saved: string; onSet: (url: string) => void }) {
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState(false);
  const errorId = useId();
  const url = normalisedScreenLink(draft);
  return (
    <form
      className="flex flex-col gap-1.5 px-6 pb-6 pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!url) return;
        if (!isScreenLink(url)) {
          setError(true);
          return;
        }
        onSet(url);
      }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Video Link
      </span>
      <div className="flex gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 focus-within:ring-2 focus-within:ring-brand-500 dark:border-slate-700 dark:bg-slate-900">
          <LinkGlyph />
          <input
            aria-label="Video link"
            aria-invalid={error || undefined}
            aria-describedby={error ? errorId : undefined}
            value={draft}
            autoComplete="off"
            spellCheck={false}
            placeholder="A YouTube, Vimeo or Loom link"
            onChange={(e) => {
              setDraft(e.target.value);
              setError(false);
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
        </label>
        <Button type="submit" variant="primary" size="sm" disabled={!url || url === saved}>
          Set
        </Button>
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-[12px] font-medium text-rose-700 dark:text-rose-300"
        >
          That isn&apos;t a video link
        </p>
      ) : null}
      <p className="pt-1 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
        {words.videoLine}
      </p>
    </form>
  );
}
