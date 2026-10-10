'use client';

import {
  TEXT_BOX_LINE_HEIGHT_REM,
  TEXT_BOX_MAX_LINES,
  TEXTS_URL_PREFIX,
} from '@livediagram/licences';
import { useEffect, useRef, useState } from 'react';

export type LicenceTextRef = { label: string; hash: string; lines: number };

// A text box's height, fixed from its line count before anything loads, so
// loading, failing or finishing never moves the page (blueprint "Web Experience").
const textBoxHeight = (lines: number) =>
  `calc(${Math.min(Math.max(lines, 1), TEXT_BOX_MAX_LINES) * TEXT_BOX_LINE_HEIGHT_REM}rem + 1.5rem + 2px)`;

const textUrl = (hash: string) => `${TEXTS_URL_PREFIX}${hash}.txt`;

// An entry's licence texts. They load from static files the first time their
// <details> opens, so the page's HTML carries none of them.
export function LicenceTexts({ work, texts }: { work: string; texts: LicenceTextRef[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const details = ref.current?.closest('details');
    if (!details) return;
    const onToggle = () => {
      if (details.open) setOpened(true);
    };
    onToggle();
    details.addEventListener('toggle', onToggle);
    return () => details.removeEventListener('toggle', onToggle);
  }, []);

  return (
    <div ref={ref} className="space-y-4">
      {texts.map((text, i) => (
        <LicenceTextBox key={`${i}-${text.hash}`} work={work} text={text} opened={opened} />
      ))}
    </div>
  );
}

type Loaded = { text: string } | { failed: true };

function LicenceTextBox({
  work,
  text: { label, hash, lines },
  opened,
}: {
  work: string;
  text: LicenceTextRef;
  opened: boolean;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const url = textUrl(hash);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    fetch(url)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(url))))
      .then(
        (body) => !cancelled && setLoaded({ text: body.replace(/\n$/, '') }),
        () => !cancelled && setLoaded({ failed: true }),
      );
    return () => {
      cancelled = true;
    };
  }, [opened, url]);

  const content =
    loaded === null
      ? `Loading ${label}…`
      : 'text' in loaded
        ? loaded.text
        : 'This text could not be loaded. Open the plain-text file instead.';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="lic-label">{label}</p>
        <a
          href={url}
          aria-label={`Plain text of ${label} for ${work}`}
          className="lic-link text-xs"
        >
          Plain text
        </a>
      </div>
      <pre
        tabIndex={0}
        role="region"
        aria-label={`${label} for ${work}`}
        aria-busy={loaded === null}
        style={{ height: textBoxHeight(lines) }}
        className="lic-box"
      >
        {content}
      </pre>
    </div>
  );
}
