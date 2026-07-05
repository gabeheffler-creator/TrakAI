import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useListMessages, useSendMessage, useMarkMessagesRead, getListMessagesQueryKey, useGetCoachUnreadCount, getGetCoachUnreadCountQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Send, ArrowLeft } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";

interface Conversation {
  clientId: number;
  name: string;
  lastMessage: { content: string; sender: string; createdAt: string } | null;
  unreadCount: number;
}

function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ["coach-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/coach/conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    refetchInterval: 8000,
  });
}

function avatarColor(id: number): string {
  const colors = ["bg-violet-500", "bg-blue-500", "bg-green-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500", "bg-teal-500", "bg-pink-500"];
  return colors[id % colors.length];
}
function initials(name: string): string {
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

function ConversationPanel({ clientId }: { clientId: number }) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: messages, isLoading, isError, refetch, isFetching } = useListMessages(clientId, {
    query: { queryKey: getListMessagesQueryKey(clientId), refetchInterval: 4000 },
  });
  const sendMessage = useSendMessage();
  const markRead = useMarkMessagesRead();

  useEffect(() => {
    markRead.mutate({ clientId, data: { reader: "coach" } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCoachUnreadCountQueryKey() });
        qc.invalidateQueries({ queryKey: ["coach-conversations"] });
      },
    });
  }, [clientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    setInput("");
    sendMessage.mutate({ clientId, data: { sender: "coach", content } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId) });
        qc.invalidateQueries({ queryKey: ["coach-conversations"] });
      },
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground text-center">Loading…</p>}
        {isError && (
          <QueryErrorState
            message="Couldn't load messages. This is usually temporary."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            testId="button-retry-messages"
          />
        )}
        {!isError && messages?.map(m => (
          <div key={m.id} className={cn("flex", m.sender === "coach" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[75%] px-4 py-2 rounded-2xl text-sm", m.sender === "coach" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm")}>
              <p className="leading-relaxed">{m.content}</p>
              <p className={cn("text-[10px] mt-1 opacity-60", m.sender === "coach" ? "text-right" : "text-left")}>
                {formatDistanceToNow(parseISO(m.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
        {messages?.length === 0 && !isLoading && !isError && (
          <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation!</p>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border px-4 py-3 flex gap-2 flex-shrink-0">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type a message…"
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim() || sendMessage.isPending}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Send className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="font-semibold">No conversation selected</p>
      <p className="text-sm text-muted-foreground mt-1">Select a client on the left to open a conversation</p>
    </div>
  );
}

export function Messages() {
  const params = useParams<{ clientId?: string }>();
  const [, navigate] = useLocation();
  const activeClientId = params.clientId ? Number(params.clientId) : null;

  const { data: conversations, isLoading, isError, refetch, isFetching } = useConversations();

  return (
    <div className="-m-4 md:-m-8 h-[calc(100vh-3.5rem)] sm:h-screen flex overflow-hidden border-t border-border relative">
      <div className={cn("w-full sm:w-80 md:w-88 flex-shrink-0 border-r border-border flex flex-col", activeClientId ? "hidden sm:flex" : "flex")}>
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <h1 className="font-semibold text-base">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && <div className="px-1 py-8 text-center text-sm text-muted-foreground">Loading…</div>}
          {isError && (
            <QueryErrorState
              message="Couldn't load conversations. This is usually temporary."
              onRetry={() => refetch()}
              isRetrying={isFetching}
              testId="button-retry-conversations"
            />
          )}
          {!isLoading && !isError && conversations?.length === 0 && <div className="px-1 py-8 text-center text-sm text-muted-foreground">No clients yet</div>}
          {!isError && conversations?.map(conv => {
            const isActive = activeClientId === conv.clientId;
            return (
              <button
                key={conv.clientId}
                onClick={() => navigate(`/messages/${conv.clientId}`)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors",
                  isActive
                    ? "bg-primary/10 border-primary/30"
                    : "border-border hover:bg-muted/60 bg-card"
                )}
              >
                <div className="relative flex-shrink-0">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold", avatarColor(conv.clientId))}>
                    {initials(conv.name)}
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold truncate", isActive && "text-primary")}>{conv.name}</p>
                  {conv.lastMessage ? (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.lastMessage.sender === "coach" ? "You: " : ""}{conv.lastMessage.content}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic mt-0.5">No messages yet</p>
                  )}
                </div>
                {conv.lastMessage && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(parseISO(conv.lastMessage.createdAt), { addSuffix: false })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn("flex-1 flex flex-col", activeClientId ? "flex" : "hidden sm:flex")}>
        {activeClientId && (
          <div className="sm:hidden flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/messages")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium">Back to messages</span>
          </div>
        )}
        {activeClientId ? <ConversationPanel clientId={activeClientId} /> : <EmptyState />}
      </div>
    </div>
  );
}
