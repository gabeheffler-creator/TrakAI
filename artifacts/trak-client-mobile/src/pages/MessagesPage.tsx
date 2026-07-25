import { useState, useEffect, useRef, useCallback } from "react";

interface Message {
  id: number;
  sender: "coach" | "client";
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface MessagesPageProps {
  clientId: number;
  clientName: string;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const S = {
  page: {
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    background: "#0f172a",
    color: "#f1f5f9",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    padding: "18px 20px 14px",
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    flexShrink: 0,
  },
};

export default function MessagesPage({ clientId, clientName }: MessagesPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (markRead = false) => {
    try {
      const data = await apiFetch<Message[]>(`/api/clients/${clientId}/messages`);
      const sorted = [...data].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(sorted);
      if (markRead) {
        fetch(`/api/clients/${clientId}/messages/read`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reader: "client" }),
        }).catch(() => {});
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchMessages(true);
    const iv = setInterval(() => fetchMessages(false), 8_000);
    return () => clearInterval(iv);
  }, [fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    try {
      await apiFetch(`/api/clients/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: "client", content }),
      });
      fetchMessages(false);
    } catch {
      setText(content); // restore on failure
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>Messages</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Your coach</div>
      </div>

      {/* Message thread */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>Loading…</div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center" }}>
            <div style={{ fontSize: 32 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>No messages yet</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Send your coach a message below.</div>
          </div>
        ) : (
          messages.map(msg => {
            const isClient = msg.sender === "client";
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isClient ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "78%",
                  padding: "10px 14px",
                  borderRadius: isClient ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: isClient ? "#6d28d9" : "#1e293b",
                  border: isClient ? "none" : "1px solid #334155",
                  color: "#f1f5f9",
                  fontSize: 14,
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                }}>
                  {msg.content}
                </div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 3, marginLeft: 4, marginRight: 4 }}>
                  {formatTime(msg.createdAt)}
                  {isClient && msg.readAt && <span style={{ marginLeft: 4, color: "#6d28d9" }}>✓ Read</span>}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        style={{
          display: "flex",
          gap: 10,
          padding: "12px 16px 14px",
          background: "#1e293b",
          borderTop: "1px solid #334155",
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          placeholder="Message your coach…"
          value={text}
          onChange={e => setText(e.target.value)}
          style={{
            flex: 1,
            padding: "11px 14px",
            borderRadius: 22,
            border: "1.5px solid #334155",
            background: "#0f172a",
            color: "#f1f5f9",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "none",
            background: text.trim() && !sending ? "#7c3aed" : "#334155",
            color: text.trim() && !sending ? "#fff" : "#64748b",
            fontSize: 18,
            cursor: text.trim() && !sending ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ↑
        </button>
      </form>
    </div>
  );
}
