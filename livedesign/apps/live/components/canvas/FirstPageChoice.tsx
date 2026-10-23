'use client';

// The first page's own choice (docs/specs/007-editor/pages-mode.md "Page kinds"): while a tab's
// only page is unchosen and empty, it offers the kinds of page inside itself, the same cards as the
// add-a-page popover. Logo turns it into the 1024 artboard; Wireframe asks for its device; Photo makes
// it a photo page, its Start a Photo card asking for a picture. Held at one screen size, centred on
// the page.
import type { PageKind, WireframeDeviceId } from '@livedesign/design';
import { useRef, useState } from 'react';
import { rememberWireframeDevice } from '@/lib/wireframe-device-memory';
import { ChooseDeviceStep } from './wireframe/ChooseDeviceStep';
import { moveBetweenKindCards, PAGE_KINDS, PageKindCard } from './page-kind-cards';

export function FirstPageChoice({
  zoom,
  onChoose,
}: {
  zoom: number;
  onChoose: (kind: PageKind, device?: WireframeDeviceId) => void;
}) {
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  // Wireframe turns the choice to Choose a Device (docs/specs/007-editor/wireframe-pages.md).
  const [choosingDevice, setChoosingDevice] = useState(false);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <div
        role="group"
        aria-labelledby="first-page-choice-title"
        data-first-page-choice=""
        className="pointer-events-auto w-[420px] animate-fade-in rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
        style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {choosingDevice ? (
          <ChooseDeviceStep
            onBack={() => setChoosingDevice(false)}
            onChoose={(device) => {
              rememberWireframeDevice(device);
              onChoose('wireframe', device);
            }}
          />
        ) : (
          <>
            <p
              id="first-page-choice-title"
              className="px-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              What Is This Page For?
            </p>
            <p className="mb-2.5 mt-0.5 px-0.5 text-xs text-slate-500 dark:text-slate-400">
              Choose now: a page keeps its kind once you start.
            </p>
            <div
              className="grid grid-cols-2 gap-2"
              // Arrow keys move between the cards, as in the Add a Page popover.
              onKeyDown={(e) => moveBetweenKindCards(e, cards.current)}
            >
              {PAGE_KINDS.map((k, i) => (
                <PageKindCard
                  key={k.kind}
                  choice={k}
                  wide={PAGE_KINDS.length % 2 === 1 && i === PAGE_KINDS.length - 1}
                  ref={(el) => {
                    cards.current[i] = el;
                  }}
                  onChoose={() =>
                    k.kind === 'wireframe' ? setChoosingDevice(true) : onChoose(k.kind)
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
