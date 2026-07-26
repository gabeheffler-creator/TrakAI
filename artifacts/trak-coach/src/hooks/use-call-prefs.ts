import { useState } from "react";

const KEY = "trak_coach_call_prefs";

interface CallPrefs {
  autoCallLog: boolean;
  autoCallNotes: boolean;
  reviewCallNotes: boolean;
}

function read(): CallPrefs {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return { autoCallLog: true, autoCallNotes: true, reviewCallNotes: true, ...JSON.parse(v) };
  } catch {}
  return { autoCallLog: true, autoCallNotes: true, reviewCallNotes: true };
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
    reviewCallNotes: prefs.reviewCallNotes,
    setAutoCallLog: (v: boolean) => set({ autoCallLog: v }),
    setAutoCallNotes: (v: boolean) => {
      // If auto call notes is turned off, also disable review
      set({ autoCallNotes: v, ...(v ? {} : { reviewCallNotes: false }) });
    },
    setReviewCallNotes: (v: boolean) => set({ reviewCallNotes: v }),
  };
}
