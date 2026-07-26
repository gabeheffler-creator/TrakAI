import { useEffect, useRef, useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListMessages,
  useSendMessage,
  useMarkMessagesRead,
  getListMessagesQueryKey,
  useAcceptTask,
  useRejectTask,
  type ClientTask,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { QueryErrorState } from "@/components/query-error-state";

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

// ── Task card for client messages ─────────────────────────────────────────────

function ClientTaskCard({
  task,
  messageType,
  content,
  clientId,
  onAction,
}: {
  task: ClientTask;
  messageType: string;
  content: string;
  clientId: number;
  onAction: () => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const acceptTask = useAcceptTask();
  const rejectTask = useRejectTask();

  const isAlt = messageType === "task_alternative";
  const label = isAlt ? "Alternative" : "Task";

  // Determine if action buttons should show
  const isPendingMain = !isAlt && task.status === "pending";
  const isPendingAlt = isAlt && task.status === "rejected" && task.altStatus === "pending";
  const canAct = isPendingMain || isPendingAlt;

  const isAccepted = task.status === "accepted" || task.altStatus === "accepted";
  const isRejected = (isPendingMain && task.status === "rejected") || (isPendingAlt && task.altStatus === "rejected");
  const isCompleted = task.status === "completed";

  const handleAccept = () => {
    acceptTask.mutate({ clientId, taskId: task.id }, { onSuccess: onAction });
  };

  const handleReject = () => {
    const r = rejectReason.trim();
    if (!r) return;
    rejectTask.mutate({ clientId, taskId: task.id, data: { reason: r } }, {
      onSuccess: () => { setRejectOpen(false); setRejectReason(""); onAction(); },
    });
  };

  return (
    <>
      <div className={cn(
        "rounded-xl border px-4 py-3 space-y-2 max-w-[85%]",
        isAlt
          ? "border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800"
          : "border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800"
      )}>
        <p className={cn("text-[10px] font-bold uppercase tracking-widest", isAlt ? "text-amber-600" : "text-violet-600")}>{label}</p>
        <p className="text-sm leading-relaxed text-foreground">{content}</p>

        {canAct && (
          <div className="flex gap-2 pt-1">
            <Button
              className="h-11 text-sm flex-1"
              disabled={acceptTask.isPending}
              onClick={handleAccept}
              data-testid="button-accept-task"
            >
              Accept
            </Button>
            <Button
              variant="outline"
              className="h-11 text-sm flex-1"
              onClick={() => setRejectOpen(true)}
              data-testid="button-reject-task"
            >
              Reject
            </Button>
          </div>
        )}

        {isAccepted && !isCompleted && <p className="text-xs text-emerald-600 font-medium">✓ Accepted — check your home screen</p>}
        {isCompleted && <p className="text-xs text-emerald-700 font-medium">✓ Completed</p>}
        {(task.status === "rejected" && !isAlt) && <p className="text-xs text-rose-500 font-medium">Rejected</p>}
        {(task.altStatus === "rejected" && isAlt) && <p className="text-xs text-rose-500 font-medium">Alternative rejected</p>}
        {task.altStatus === "left_alone" && <p className="text-xs text-muted-foreground font-medium">Coach left this one alone</p>}
      </div>

      <Dialog open={rejectOpen} onOpenChange={v => { if (!v) { setRejectOpen(false); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle>Why?</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Tell your coach why you can't do this…"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={4}
            className="resize-none"
            autoFocus
            data-testid="dialog-reject-reason"
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setRejectOpen(false); setRejectReason(""); }}>Cancel</Button>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectTask.isPending}
              data-testid="button-dialog-send-rejection"
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MessagesPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading, isError, refetch, isFetching } = useListMessages(clientId!, {
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

  const invalidate = () => qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId!) });

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
        {isError && (
          <QueryErrorState
            message="Couldn't load messages. This is usually temporary."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            testId="button-retry-messages"
          />
        )}
        {!isLoading && !isError && (messages?.length ?? 0) === 0 && (
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
        {!isError && messages?.map((m, i) => {
          const isClient = m.sender === "client";
          const prev = messages[i - 1];
          const showTime =
            !prev ||
            Math.abs(parseISO(m.createdAt).getTime() - parseISO(prev.createdAt).getTime()) >
              5 * 60 * 1000;
          const mt = (m as any).messageType as string | undefined;
          const task = (m as any).task as ClientTask | null | undefined;

          // Task / alternative cards — rendered as cards from coach
          if ((mt === "task_assigned" || mt === "task_alternative") && task) {
            return (
              <div key={m.id} data-testid={`msg-${m.id}`}>
                {showTime && (
                  <p className="text-center text-xs text-muted-foreground my-3">{formatTime(m.createdAt)}</p>
                )}
                <div className="flex justify-start items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-0.5">
                    C
                  </div>
                  <ClientTaskCard
                    task={task}
                    messageType={mt}
                    content={m.content}
                    clientId={clientId}
                    onAction={invalidate}
                  />
                </div>
              </div>
            );
          }

          // Rejection card — sent by client, shown as inline card
          if (mt === "task_rejected" && task) {
            return (
              <div key={m.id} data-testid={`msg-${m.id}`}>
                {showTime && (
                  <p className="text-center text-xs text-muted-foreground my-3">{formatTime(m.createdAt)}</p>
                )}
                <div className="flex justify-end">
                  <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 px-4 py-3 space-y-1 max-w-[85%]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">You rejected this task</p>
                    <p className="text-sm leading-relaxed text-foreground">{m.content}</p>
                    {task.altStatus === "pending" && (
                      <p className="text-xs text-amber-600 font-medium mt-1">Alternative incoming…</p>
                    )}
                    {task.altStatus === "left_alone" && (
                      <p className="text-xs text-muted-foreground font-medium mt-1">Coach left this alone</p>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // Regular chat bubbles
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
