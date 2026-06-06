import { useState } from "react";

const CLIENT_ID_KEY = "trak_client_id";
const DEV_DEFAULT_CLIENT_ID = 1;

function readClientId(): number | null {
  const val = localStorage.getItem(CLIENT_ID_KEY);
  if (val) {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
  // In development, default to client 1 so the preview works without a join flow
  if (import.meta.env.DEV) {
    localStorage.setItem(CLIENT_ID_KEY, String(DEV_DEFAULT_CLIENT_ID));
    return DEV_DEFAULT_CLIENT_ID;
  }
  return null;
}

export function useClientId() {
  const [clientId, setClientIdState] = useState<number | null>(readClientId);

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
