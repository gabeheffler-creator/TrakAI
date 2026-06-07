export function TrakLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 44 44" fill="none" className="flex-shrink-0">
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
  );
}
