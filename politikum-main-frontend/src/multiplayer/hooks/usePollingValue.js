import { useEffect, useRef, useState } from 'react';

export default function usePollingValue(loader, options = {}) {
  const {
    deps = [],
    initialValue = null,
    initialError = '',
    intervalMs = 5000,
    getIntervalMs = null,
    enabled = true,
  } = options;

  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(Boolean(enabled));
  const timerRef = useRef(null);
  const aliveRef = useRef(true);
  const latestValueRef = useRef(initialValue);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    aliveRef.current = true;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!enabled) {
      setLoading(false);
      clearTimer();
      return () => {
        aliveRef.current = false;
        clearTimer();
      };
    }

    const schedule = (nextValue) => {
      clearTimer();
      if (!aliveRef.current) return;
      const ms = typeof getIntervalMs === 'function'
        ? Number(getIntervalMs(nextValue, latestValueRef.current)) || intervalMs
        : intervalMs;
      timerRef.current = setTimeout(run, Math.max(100, ms));
    };

    const run = async () => {
      try {
        const nextValue = await loader();
        if (!aliveRef.current) return;
        latestValueRef.current = nextValue;
        setValue(nextValue);
        setError('');
        setLoading(false);
        schedule(nextValue);
      } catch (e) {
        if (!aliveRef.current) return;
        setError(e?.message || String(e));
        setLoading(false);
        schedule(latestValueRef.current);
      }
    };

    setLoading(true);
    run();

    return () => {
      aliveRef.current = false;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, getIntervalMs, ...deps]);

  return { value, setValue, error, setError, loading };
}
