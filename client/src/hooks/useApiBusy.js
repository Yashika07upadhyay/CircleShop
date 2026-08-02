import { useCallback, useRef, useState } from 'react';

/** Prevents duplicate in-flight API calls from rapid button clicks. */
export function useApiBusy() {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const run = useCallback(async (fn) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
