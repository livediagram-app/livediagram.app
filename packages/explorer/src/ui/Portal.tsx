import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Renders into document.body, once mounted in the browser.
export function Portal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(children, host) : null;
}
