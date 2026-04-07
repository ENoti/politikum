import { useEffect, useState } from 'react';

export default function useSessionStorageState(key, initialValue, { serialize = JSON.stringify, deserialize = JSON.parse } = {}) {
  const readInitial = () => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initialValue;
      return deserialize(raw);
    } catch {
      return initialValue;
    }
  };

  const [value, setValue] = useState(readInitial);

  useEffect(() => {
    try {
      if (value == null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, serialize(value));
    } catch {}
  }, [key, serialize, value]);

  return [value, setValue];
}
