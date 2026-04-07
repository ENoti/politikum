import { useCallback, useEffect, useState } from 'react';

export default function useHashRoute(defaultHash = '') {
  const readHash = () => {
    try {
      const value = String(window.location.hash || '').trim();
      return value || defaultHash;
    } catch {
      return defaultHash;
    }
  };

  const [hash, setHash] = useState(readHash);

  useEffect(() => {
    const onHashChange = () => setHash(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateHash = useCallback((nextHash) => {
    const value = String(nextHash || '').trim();
    try {
      window.location.hash = value;
      if (!value) setHash(defaultHash);
    } catch {}
  }, [defaultHash]);

  return { hash, navigateHash, isHashRoute: (prefix) => hash.startsWith(String(prefix || '')) };
}
