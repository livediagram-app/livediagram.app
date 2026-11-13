'use client';

// Share Form's QR Code (docs/specs/030-forms/forms.md "Publishing and the form link"): the form link as a QR code,
// with Download PNG and Download SVG. The encoder loads on first open (form-qr.ts); until then a placeholder square
// holds the space, and a failed load says so with Try Again.
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@liveplanner/ui';
import { downloadBlob } from '@liveworkspace/workbench/lib/download-blob';
import { track } from '@/lib/telemetry';
import {
  loadQr,
  qrFileName,
  qrModules,
  qrPath,
  qrPngBlob,
  qrSvgText,
  type QrModules,
} from './form-qr';

type Encoder = Awaited<ReturnType<typeof loadQr>>;

export function ShareQrPanel({ url, heading }: { url: string; heading: string }) {
  const [encode, setEncode] = useState<Encoder | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadQr().then(
      (e) => live && setEncode(() => e),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  const modules: QrModules | null = useMemo(
    () => (encode ? qrModules(encode, url) : null),
    [encode, url],
  );

  if (failed) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/60">
        <p role="alert" className="text-[13px] text-slate-700 dark:text-slate-200">
          We couldn’t make the QR code. Check your connection and try again.
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-stretch">
      {/* Black on white in both halves: a dark-mode QR code is one many cameras miss. */}
      <div className="mx-auto shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-600">
        {modules ? (
          <svg
            role="img"
            aria-label="QR code for the form link"
            viewBox={`0 0 ${modules.size} ${modules.size}`}
            shapeRendering="crispEdges"
            className="block size-40"
          >
            <path d={qrPath(modules)} fill="#000" />
          </svg>
        ) : (
          <div
            role="status"
            aria-label="Making the QR code"
            className="size-40 animate-pulse rounded bg-slate-100 motion-reduce:animate-none"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          Point a phone camera at it to open the form. Print it on a poster, a slide or a table
          card.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!modules}
            onClick={() => {
              if (!modules) return;
              track('Form', 'Shared', 'QrPng');
              void qrPngBlob(modules).then((blob) => {
                if (blob) downloadBlob(blob, qrFileName(heading, 'png'));
              });
            }}
          >
            Download PNG
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!modules}
            onClick={() => {
              if (!modules) return;
              track('Form', 'Shared', 'QrSvg');
              downloadBlob(
                new Blob([qrSvgText(modules)], { type: 'image/svg+xml' }),
                qrFileName(heading, 'svg'),
              );
            }}
          >
            Download SVG
          </Button>
        </div>
      </div>
    </div>
  );
}
