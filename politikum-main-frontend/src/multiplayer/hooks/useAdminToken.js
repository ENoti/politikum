import { useCallback, useState } from 'react';

export default function useAdminToken() {
  const [token, setToken] = useState(() => {
    try { return window.localStorage.getItem('politikum.adminToken') || ''; } catch { return ''; }
  });

  const saveToken = useCallback((value) => {
    setToken(value);
    try { window.localStorage.setItem('politikum.adminToken', value); } catch {}
  }, []);

  return { token, setToken: saveToken, saveToken };
}
