import { useState } from "react";

export interface NotificationPrefs {
  workoutReminders: boolean;
  taskAlerts: boolean;
  messageNotifications: boolean;
}

const KEY = "trak_notification_prefs";

const DEFAULTS: NotificationPrefs = {
  workoutReminders: true,
  taskAlerts: true,
  messageNotifications: true,
};

function read(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

function write(prefs: NotificationPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
}

export function useNotificationPrefs() {
  const [prefs, setPrefsState] = useState<NotificationPrefs>(read);

  const setPref = <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
    const next = { ...prefs, [key]: value };
    write(next);
    setPrefsState(next);
  };

  return { prefs, setPref };
}
