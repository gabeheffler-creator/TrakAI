import { useState, useEffect } from "react";

interface CoachBrand {
  name?: string | null;
  tagline?: string | null;
  logoPath?: string | null;
}

export function TrakLogo() {
  const [coachBrand, setCoachBrand] = useState<CoachBrand | null>(null);

  useEffect(() => {
    fetch("/api/client/coach-brand")
      .then(r => r.ok ? r.json() as Promise<CoachBrand> : null)
      .then(data => { if (data) setCoachBrand(data); })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <svg width="28" height="28" viewBox="0 0 44 44" fill="none" className="flex-shrink-0">
          <rect width="44" height="44" rx="12" fill="#7c3aed" />
          <polyline
            points="6,22 13,22 17,12 21,32 25,18 29,22 38,22"
            stroke="white"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <div className="flex items-baseline gap-0">
          <span className="text-lg font-extrabold tracking-tight text-foreground leading-none">Trak</span>
          <span className="text-lg font-light tracking-tight text-violet-500 leading-none">Client</span>
        </div>
      </div>
      {coachBrand?.logoPath && (
        <img
          src={`/api/storage${coachBrand.logoPath}`}
          alt="Coach logo"
          className="h-7 w-auto object-contain"
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}
