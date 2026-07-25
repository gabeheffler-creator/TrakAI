import { useState, useEffect, useRef } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListMessages, getListMessagesQueryKey,
  useSendMessage,
  useMarkMessagesRead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { QueryErrorState } from "@/components/query-error-state";
import { useAuth } from "@/contexts/AuthContext";

export function MessagesPage() {
  const { clientId } = useClientId();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const {
    data: messages,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useListMessages(clientId!, {
    query: {
      enabled: !!clientId,
      queryKey: getListMessagesQueryKey(clientId!),
      refetchInterval: 5000,
    },
  });

  const send = useSendMessage();
  const markRead = useMarkMessagesRead();

  // Mark unread as read on mount
  useEffect(() => {
    if (!clientId) return;
    markRead.mutate(
      { clientId, data: { reader: "client" } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId) });
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Scroll to bottom when messages arrive
  useEffect(() => {
    if (messages) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [messages]);

  const handleSend = () => {
    if (!text.trim() || !clientId) return;
    const content = text.trim();
    setText("");
    send.mutate(
      { clientId, data: { content, sender: "client" } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId) });
        },
      }
    );
  };

  if (!clientId) return null;

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2 flex-shrink-0 bg-background">
        <MessageCircle className="w-5 h-5 text-primary" />
        <h1 className="font-bold text-base">Messages</h1>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto phone-scroll px-4 py-3 space-y-3 min-h-0">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-10 max-w-[70%] rounded-2xl bg-muted/50 animate-pulse",
                  i % 2 === 0 ? "ml-auto" : ""
                )}
              />
            ))}
          </div>
        ) : isError ? (
          <QueryErrorState
            message="Couldn't load messages."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            className="pt-12"
          />
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center gap-3">
            <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No messages yet. Say hi to your coach!</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isClient = msg.sender === "client";
              return (
                <div
                  key={msg.id}
                  className={cn("flex flex-col gap-0.5", isClient ? "items-end" : "items-start")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      isClient
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 px-1">
                    {format(parseISO(msg.createdAt), "MMM d h:mma").toLowerCase()}
                    {isClient && msg.readAt && (
                      <span className="ml-1 text-emerald-500">✓ read</span>
                    )}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 pt-2 pb-3 border-t border-border bg-background flex-shrink-0">
        <div className="flex gap-2 items-center">
          <Input
            className="flex-1 text-sm h-10"
            placeholder="Message your coach…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            disabled={!text.trim() || send.isPending}
            onClick={handleSend}
            className="bg-primary hover:bg-primary/90 w-10 h-10 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
