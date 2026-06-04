import { useState, useEffect } from "react";

const CLIENT_ID_KEY = "trak_client_id";

export function useClientId() {
  const [clientId, setClientIdState] = useState<number | null>(() => {
    const val = localStorage.getItem(CLIENT_ID_KEY);
    if (!val) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  });

  const setClientId = (id: number) => {
    localStorage.setItem(CLIENT_ID_KEY, String(id));
    setClientIdState(id);
  };

  const clearClientId = () => {
    localStorage.removeItem(CLIENT_ID_KEY);
    setClientIdState(null);
  };

  return { clientId, setClientId, clearClientId };
}
