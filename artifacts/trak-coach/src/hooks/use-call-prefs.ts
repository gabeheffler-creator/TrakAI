import { useState } from "react";

const KEY = "trak_coach_call_prefs";

interface CallPrefs {
  autoCallLog: boolean;
  autoCallNotes: boolean;
}

function read(): CallPrefs {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return { autoCallLog: true, autoCallNotes: true, ...JSON.parse(v) };
  } catch {}
  return { autoCallLog: true, autoCallNotes: true };
}

export function useCallPrefs() {
  const [prefs, setPrefsState] = useState<CallPrefs>(read);

  const set = (patch: Partial<CallPrefs>) => {
    const next = { ...prefs, ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    setPrefsState(next);
  };

  return {
    autoCallLog: prefs.autoCallLog,
    autoCallNotes: prefs.autoCallNotes,
    setAutoCallLog: (v: boolean) => set({ autoCallLog: v }),
    setAutoCallNotes: (v: boolean) => set({ autoCallNotes: v }),
  };
}
