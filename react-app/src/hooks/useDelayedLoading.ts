import { useEffect, useState } from 'react';

export function useDelayedLoading(isLoading: boolean, delayMs = 250) {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowLoading(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs, isLoading]);

  return showLoading;
}
