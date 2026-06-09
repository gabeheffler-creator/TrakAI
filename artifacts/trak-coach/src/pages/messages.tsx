import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useListClients,
  useListMessages,
  useSendMessage,
  useMarkMessagesRead,
  useGetCoachUnreadCount,
  getListMessagesQueryKey,
  getGetCoachUnreadCountQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Send, MessageCircle, ArrowLeft, Smile } from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { usePushNotifications } from "@/hooks/use-push-notifications";

function formatTime(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function initials(name: string) {
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

const avatarColors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-pink-500", "bg-teal-500"];
function avatarColor(id: number) { return avatarColors[id % avatarColors.length]; }

const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\u200d|\s)+$/u;
function isEmojiOnly(text: string) { return EMOJI_RE.test(text.trim()) && text.trim().length > 0; }

const msgSchema = z.object({ content: z.string().min(1) });

function ConversationPanel({ clientId }: { clientId: number }) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: clients } = useListClients();
  const client = clients?.find(c => c.id === clientId);

  const { data: messages, isLoading } = useListMessages(clientId, {
    query: { queryKey: getListMessagesQueryKey(clientId), refetchInterval: 4000 },
  });

  const send = useSendMessage();
  const markRead = useMarkMessagesRead();
  const { requestPermissionAndSubscribe } = usePushNotifications();

  const form = useForm<z.infer<typeof msgSchema>>({
    resolver: zodResolver(msgSchema),
    defaultValues: { content: "" },
  });

  // Mark all client messages as read when conversation opens
  useEffect(() => {
    markRead.mutate(
      { clientId, data: { reader: "coach" } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetCoachUnreadCountQueryKey() }) }
    );
    // Request push permission silently
    requestPermissionAndSubscribe("coach");
  }, [clientId]);

  // Re-mark as read when new messages arrive
  useEffect(() => {
    if (!messages) return;
    const hasUnread = messages.some(m => m.sender === "client" && !m.readAt);
    if (hasUnread) {
      markRead.mutate(
        { clientId, data: { reader: "coach" } },
        { onSuccess: () => qc.invalidateQueries({ queryKey: getGetCoachUnreadCountQueryKey() }) }
      );
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close picker on outside click
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
    send.mutate(
      { clientId, data: { sender: "coach", content: values.content } },
      { onSuccess: () => { qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId) }); form.reset(); } }
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0", avatarColor(clientId))}>
          {client ? initials(client.name) : "?"}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{client?.name ?? "Client"}</p>
          <p className="text-xs text-muted-foreground truncate">{client?.email}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
        {isLoading && <p className="text-xs text-muted-foreground text-center">Loading…</p>}
        {!isLoading && messages?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages?.map((m, i) => {
          const isCoach = m.sender === "coach";
          const prev = messages[i - 1];
          const showTime = !prev || Math.abs(parseISO(m.createdAt).getTime() - parseISO(prev.createdAt).getTime()) > 5 * 60 * 1000;
          const emojiOnly = isEmojiOnly(m.content);
          return (
            <div key={m.id}>
              {showTime && (
                <p className="text-center text-xs text-muted-foreground my-3">{formatTime(m.createdAt)}</p>
              )}
              <div className={cn("flex items-end gap-2", isCoach ? "justify-end" : "justify-start")}>
                {!isCoach && (
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-0.5", avatarColor(clientId))}>
                    {client ? initials(client.name) : "?"}
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
                  <div className={cn(
                    "max-w-[70%] rounded-2xl px-3.5 py-2 text-sm",
                    isCoach ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
                  )}>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={cn("text-[10px] mt-0.5", isCoach ? "text-primary-foreground/60 text-right" : "text-muted-foreground")}>
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

      <div className="flex-shrink-0 border-t border-border px-4 py-3">
        {showPicker && (
          <div ref={pickerRef} className="absolute bottom-20 right-4 z-50 shadow-xl rounded-xl overflow-hidden">
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2 items-center">
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
                      {...field}
                      placeholder={`Message ${client?.name ?? "client"}…`}
                      autoComplete="off"
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.handleSubmit(onSubmit)(); }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" size="icon" disabled={send.isPending} className="flex-shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <MessageCircle className="w-8 h-8 text-primary" />
      </div>
      <div>
        <p className="font-semibold">Your messages</p>
        <p className="text-sm text-muted-foreground mt-1">Select a client on the left to open a conversation</p>
      </div>
    </div>
  );
}

export function Messages() {
  const params = useParams<{ clientId?: string }>();
  const [, navigate] = useLocation();
  const activeClientId = params.clientId ? Number(params.clientId) : null;

  const { data: clients, isLoading } = useListClients();
  const { data: unread } = useGetCoachUnreadCount({ query: { queryKey: getGetCoachUnreadCountQueryKey(), refetchInterval: 8000 } });

  return (
    <div className="-m-4 md:-m-8 h-[calc(100vh-3.5rem)] sm:h-screen flex overflow-hidden border-t border-border relative">
      <div className={cn("w-full sm:w-72 md:w-80 flex-shrink-0 border-r border-border flex flex-col", activeClientId ? "hidden sm:flex" : "flex")}>
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <h1 className="font-semibold text-base">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && clients?.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No clients yet</div>}
          {clients?.map(client => {
            const isActive = activeClientId === client.id;
            const clientUnread = unread?.byClient?.[String(client.id)] ?? 0;
            return (
              <button
                key={client.id}
                onClick={() => navigate(`/messages/${client.id}`)}
                className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-colors", isActive ? "bg-primary/10" : "hover:bg-muted")}
              >
                <div className="relative flex-shrink-0">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold", avatarColor(client.id))}>
                    {initials(client.name)}
                  </div>
                  {clientUnread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {clientUnread > 9 ? "9+" : clientUnread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", isActive && "text-primary", clientUnread > 0 && "font-semibold")}>{client.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                </div>
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
