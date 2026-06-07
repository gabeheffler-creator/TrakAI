import { useState, useEffect } from "react";

export function useVideoCallStatus(clientId: number | null | undefined): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/video-call/status`);
        if (!res.ok || cancelled) return;
        const data: { active: boolean } = await res.json();
        if (!cancelled) setActive(data.active);
      } catch {
        // ignore network errors — will retry
      }
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [clientId]);

  return active;
}
