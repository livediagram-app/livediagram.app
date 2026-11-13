'use client';

// More Ways to Share's three-way switch and the panel picked (docs/specs/030-forms/forms.md "Publishing and the form
// link"). Each panel is drawn only while picked; the Pre-filled Link's picks are kept here so switching away and back
// keeps them for as long as the dialog is open.
import { useState } from 'react';
import { SegmentedToggle, type SegmentedOption } from '@liveplanner/ui';
import type { PublicForm } from '@liveplanner/forms';
import { ShareQrPanel } from './ShareQrPanel';
import { ShareEmbedPanel } from './ShareEmbedPanel';
import { SharePrefillPanel, type PrefillPicks } from './SharePrefillPanel';

type Way = 'qr' | 'embed' | 'prefill';

const WAYS: readonly SegmentedOption<Way>[] = [
  { value: 'qr', label: 'QR Code', description: 'A code a phone camera opens the form from' },
  { value: 'embed', label: 'Embed', description: 'Code that shows the form on your website' },
  {
    value: 'prefill',
    label: 'Pre-filled Link',
    description: 'A link that opens the form with answers already filled in',
  },
];

const EMPTY: PrefillPicks = {};

export function ShareWays({ url, form }: { url: string; form: PublicForm }) {
  const [way, setWay] = useState<Way>('qr');
  const [picks, setPicks] = useState<PrefillPicks>(EMPTY);
  return (
    <>
      <SegmentedToggle
        label="Ways to share"
        value={way}
        onChange={setWay}
        options={WAYS}
        className="self-start max-sm:w-full max-sm:[&>*]:flex-1 max-sm:[&_button]:w-full"
      />
      {way === 'qr' ? <ShareQrPanel url={url} heading={form.heading} /> : null}
      {way === 'embed' ? <ShareEmbedPanel url={url} heading={form.heading} /> : null}
      {way === 'prefill' ? (
        <SharePrefillPanel url={url} form={form} picks={picks} onPicks={setPicks} />
      ) : null}
    </>
  );
}
