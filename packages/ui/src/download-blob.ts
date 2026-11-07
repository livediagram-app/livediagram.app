// Trigger a browser save for a blob (an object URL on a temporary link). On its own so callers that are not
// exports (the Sheet's Download CSV) need not load the export code.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking the URL: revoking too early aborts the save
  // in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
