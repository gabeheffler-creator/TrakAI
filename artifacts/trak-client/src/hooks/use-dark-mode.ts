import { useState, useEffect } from "react";

const KEY = "trak_dark_mode";

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(KEY);
    return stored === "true";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(KEY, String(dark));
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return { dark, toggle };
}
