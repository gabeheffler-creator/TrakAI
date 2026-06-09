import { useEffect, useRef, useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListMessages,
  useSendMessage,
  useMarkMessagesRead,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, MessageCircle, Smile } from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { cn } from "@/lib/utils";

const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\u200d|\s)+$/u;
function isEmojiOnly(text: string) {
  return EMOJI_RE.test(text.trim()) && text.trim().length > 0;
}

function formatTime(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

const msgSchema = z.object({ content: z.string().min(1) });

export function MessagesPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useListMessages(clientId!, {
    query: {
      enabled: !!clientId,
      queryKey: getListMessagesQueryKey(clientId!),
      refetchInterval: 4000,
    },
  });

  const sendMessage = useSendMessage();
  const markRead = useMarkMessagesRead();
  const { requestPermissionAndSubscribe } = usePushNotifications();

  const form = useForm<z.infer<typeof msgSchema>>({
    resolver: zodResolver(msgSchema),
    defaultValues: { content: "" },
  });

  useEffect(() => {
    if (!clientId) return;
    markRead.mutate(
      { clientId, data: { reader: "client" } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId) }) }
    );
    requestPermissionAndSubscribe(clientId);
  }, [clientId]);

  useEffect(() => {
    if (!messages || !clientId) return;
    const hasUnread = messages.some(m => m.sender === "coach" && !m.readAt);
    if (hasUnread) {
      markRead.mutate(
        { clientId, data: { reader: "client" } },
        { onSuccess: () => qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId) }) }
      );
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    if (showPicker) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const onSubmit = (values: z.infer<typeof msgSchema>) => {
    setShowPicker(false);
    sendMessage.mutate(
      { clientId: clientId!, data: { sender: "client", content: values.content } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId!) });
          form.reset();
        },
      }
    );
  };

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="-m-4 md:-m-6 h-[calc(100vh-3.5rem)] sm:h-screen flex flex-col overflow-hidden border-t border-border relative">
      {/* Coach header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          C
        </div>
        <div>
          <p className="font-semibold text-sm">Your Coach</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </p>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
        {isLoading && (
          <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>
        )}
        {!isLoading && (messages?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">No messages yet</p>
              <p className="text-muted-foreground text-sm mt-0.5">Say hi to your coach! 👋</p>
            </div>
          </div>
        )}
        {messages?.map((m, i) => {
          const isClient = m.sender === "client";
          const prev = messages[i - 1];
          const showTime =
            !prev ||
            Math.abs(parseISO(m.createdAt).getTime() - parseISO(prev.createdAt).getTime()) >
              5 * 60 * 1000;
          const emojiOnly = isEmojiOnly(m.content);

          return (
            <div key={m.id} data-testid={`msg-${m.id}`}>
              {showTime && (
                <p className="text-center text-xs text-muted-foreground my-3">
                  {formatTime(m.createdAt)}
                </p>
              )}
              <div
                className={cn(
                  "flex items-end gap-2",
                  isClient ? "justify-end" : "justify-start"
                )}
              >
                {!isClient && (
                  <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-0.5">
                    C
                  </div>
                )}
                {emojiOnly ? (
                  <span
                    className="text-4xl select-none inline-block animate-[emoji-pop_0.3s_ease-out]"
                    title={format(parseISO(m.createdAt), "h:mm a")}
                  >
                    {m.content}
                  </span>
                ) : (
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm",
                      isClient
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p
                      className={cn(
                        "text-[10px] mt-1",
                        isClient
                          ? "text-primary-foreground/60 text-right"
                          : "text-muted-foreground"
                      )}
                    >
                      {format(parseISO(m.createdAt), "h:mm a")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border px-4 py-3 bg-background flex-shrink-0 relative">
        {showPicker && (
          <div
            ref={pickerRef}
            className="absolute bottom-16 left-2 z-50 shadow-xl rounded-xl overflow-hidden"
          >
            <Picker
              data={data}
              onEmojiSelect={(emoji: { native: string }) => {
                form.setValue("content", form.getValues("content") + emoji.native);
                form.setFocus("content");
              }}
              theme="auto"
              set="native"
              previewPosition="none"
              skinTonePosition="none"
            />
          </div>
        )}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex gap-2 items-center"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="flex-shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPicker(p => !p)}
            >
              <Smile className="w-5 h-5" />
            </Button>
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem className="flex-1 mb-0">
                  <FormControl>
                    <Input
                      placeholder="Message your coach…"
                      {...field}
                      data-testid="input-message"
                      autoComplete="off"
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          form.handleSubmit(onSubmit)();
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="icon"
              disabled={sendMessage.isPending}
              data-testid="button-send"
              className="flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
