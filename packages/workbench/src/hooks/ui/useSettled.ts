import { useEffect, useState } from 'react';

/** `value` once it has held still for `ms`: a search box's words, asked for only after the typing stops. */
export function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
