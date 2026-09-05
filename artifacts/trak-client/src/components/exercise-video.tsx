export function getYouTubeEmbedUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      id = url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1] ?? null;
    }
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export function ExerciseVideo({ url, title }: { url: string; title: string }) {
  const embedUrl = getYouTubeEmbedUrl(url);
  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title={`${title} demonstration`}
        className="aspect-video w-full rounded-xl bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  const src = /^https?:\/\//.test(url) ? url : `/api/storage${url}`;
  return <video src={src} controls playsInline className="w-full rounded-xl max-h-80 bg-black" />;
}