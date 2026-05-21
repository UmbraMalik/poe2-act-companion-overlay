import { useEffect, useState } from 'react';

export function useLiveNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}
