import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Loader2, Video } from "lucide-react";

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (
      domain: string,
      options: {
        roomName: string;
        parentNode: HTMLElement;
        width?: string | number;
        height?: string | number;
        configOverwrite?: Record<string, unknown>;
        userInfo?: { displayName?: string };
      }
    ) => JitsiAPI;
  }
}

interface JitsiAPI {
  dispose: () => void;
  addEventListener: (event: string, listener: () => void) => void;
}

interface VideoCallProps {
  roomName: string;
  displayName?: string;
  onClose: () => void;
}

export function VideoCall({ roomName, displayName, onClose }: VideoCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let disposed = false;

    const init = () => {
      if (disposed || !containerRef.current) return;
      try {
        setLoading(false);
        apiRef.current = new window.JitsiMeetExternalAPI("meet.jit.si", {
          roomName,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableDeepLinking: true,
            prejoinPageEnabled: false,
          },
          userInfo: displayName ? { displayName } : undefined,
        });
        apiRef.current.addEventListener("readyToClose", onClose);
      } catch {
        setError(true);
        setLoading(false);
      }
    };

    if (window.JitsiMeetExternalAPI) {
      init();
    } else {
      const existing = document.querySelector('script[src="https://meet.jit.si/external_api.js"]');
      if (existing) {
        existing.addEventListener("load", init);
      } else {
        const script = document.createElement("script");
        script.src = "https://meet.jit.si/external_api.js";
        script.async = true;
        script.onload = init;
        script.onerror = () => { setError(true); setLoading(false); };
        document.head.appendChild(script);
      }
    }

    return () => {
      disposed = true;
      apiRef.current?.dispose();
    };
  }, [roomName, displayName]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" role="dialog" aria-label="Video call">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <Video className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium">Coaching Session</span>
          <span className="text-xs text-zinc-400 ml-1">· Room: {roomName}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <p className="text-sm">Connecting to call…</p>
        </div>
      )}

      {error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <p className="text-sm">Could not load video call. Check your internet connection.</p>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      )}

      <div
        ref={containerRef}
        className={loading || error ? "hidden" : "flex-1"}
        style={{ minHeight: 0 }}
      />
    </div>
  );
}
