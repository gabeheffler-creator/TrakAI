import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  useListMessages,
  useSendMessage,
  useMarkMessagesRead,
  getListMessagesQueryKey,
  useGetCoachUnreadCount,
  getGetCoachUnreadCountQueryKey,
  useAssignTask,
  useSuggestAlternativeTask,
  useLeaveTask,
  useGetTaskAiAlternatives,
  type ClientTask,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Send, ArrowLeft, ClipboardList, Lightbulb } from "lucide-react";
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

// ── Task card rendered inside the conversation thread ─────────────────────────

function TaskCard({ task, messageType }: { task: ClientTask; messageType: string }) {
  const isAlt = messageType === "task_alternative";
  const label = isAlt ? "Alternative" : "Task";
  const text = isAlt ? (task.alternativeText ?? task.text) : task.text;

  return (
    <div className={cn(
      "rounded-xl border px-4 py-3 space-y-1 max-w-[85%]",
      isAlt ? "border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800" : "border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800"
    )}>
      <p className={cn("text-[10px] font-bold uppercase tracking-widest", isAlt ? "text-amber-600" : "text-violet-600")}>{label}</p>
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
      {task.status === "accepted" && <p className="text-xs text-emerald-600 font-medium mt-1">✓ Accepted</p>}
      {task.status === "completed" && <p className="text-xs text-emerald-700 font-medium mt-1">✓ Completed</p>}
      {task.status === "rejected" && !task.altStatus && <p className="text-xs text-rose-500 font-medium mt-1">Rejected — awaiting your response</p>}
      {task.altStatus === "pending" && <p className="text-xs text-amber-600 font-medium mt-1">Alternative sent — awaiting response</p>}
      {task.altStatus === "accepted" && <p className="text-xs text-emerald-600 font-medium mt-1">✓ Alternative accepted</p>}
      {task.altStatus === "rejected" && <p className="text-xs text-rose-500 font-medium mt-1">Alternative rejected — suggest another?</p>}
      {task.altStatus === "left_alone" && <p className="text-xs text-muted-foreground font-medium mt-1">Left alone</p>}
    </div>
  );
}

function RejectionCard({
  task,
  content,
  clientId,
  onActionDone,
}: {
  task: ClientTask;
  content: string;
  clientId: number;
  onActionDone: () => void;
}) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const leave = useLeaveTask();

  const canAct = task.status === "rejected" && !task.altStatus;

  return (
    <>
      <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 px-4 py-3 space-y-2 max-w-[85%]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Rejection</p>
        <p className="text-sm leading-relaxed text-foreground">{content}</p>
        {canAct && (
          <div className="flex gap-2 pt-1 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"
              onClick={() => setSuggestOpen(true)}
            >
              <Lightbulb className="w-3 h-3 mr-1" />
              Suggest an Alternative
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              disabled={leave.isPending}
              onClick={() => {
                leave.mutate({ clientId, taskId: task.id }, { onSuccess: onActionDone });
              }}
            >
              Leave It Alone
            </Button>
          </div>
        )}
        {task.altStatus && !canAct && (
          <p className="text-xs text-muted-foreground">
            {task.altStatus === "left_alone" ? "You left this alone." : "Alternative suggested."}
          </p>
        )}
      </div>
      <SuggestAlternativeDialog
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        clientId={clientId}
        task={task}
        onDone={() => { setSuggestOpen(false); onActionDone(); }}
      />
    </>
  );
}

function SuggestAlternativeDialog({
  open,
  onClose,
  clientId,
  task,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  clientId: number;
  task: ClientTask;
  onDone: () => void;
}) {
  const [altText, setAltText] = useState("");
  const suggest = useSuggestAlternativeTask();

  const { data: aiData, isLoading: aiLoading } = useGetTaskAiAlternatives(clientId, task.id, {
    query: { enabled: open, queryKey: ["task-ai-alternatives", clientId, task.id] },
  });
  const alternatives = aiData?.alternatives ?? [];

  useEffect(() => {
    if (!open) setAltText("");
  }, [open]);

  const handleSuggest = () => {
    const text = altText.trim();
    if (!text) return;
    suggest.mutate(
      { clientId, taskId: task.id, data: { alternativeText: text } },
      { onSuccess: onDone }
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm w-full">
        <DialogHeader>
          <DialogTitle>What else can they do?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {aiLoading && (
            <div className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}
          {!aiLoading && alternatives.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">AI suggestions — tap to use:</p>
              {alternatives.map((alt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAltText(alt)}
                  className={cn(
                    "w-full text-left text-sm px-3 py-2.5 rounded-lg border transition-colors",
                    altText === alt
                      ? "border-violet-400 bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100"
                      : "border-border hover:border-violet-300 hover:bg-muted/60"
                  )}
                >
                  <span className="text-xs text-violet-500 font-semibold mr-1">{i + 1}.</span> {alt}
                </button>
              ))}
            </div>
          )}
          <Textarea
            placeholder="Or write your own alternative…"
            value={altText}
            onChange={e => setAltText(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Nevermind</Button>
          <Button onClick={handleSuggest} disabled={!altText.trim() || suggest.isPending}>
            Suggest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignTaskDialog({
  open,
  onClose,
  clientId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  clientId: number;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const assignTask = useAssignTask();

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const handleAssign = () => {
    const t = text.trim();
    if (!t) return;
    assignTask.mutate({ clientId, data: { text: t } }, { onSuccess: onDone });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm w-full">
        <DialogHeader>
          <DialogTitle>What's the task?</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder="Describe the task for your client…"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          className="resize-none"
          autoFocus
        />
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!text.trim() || assignTask.isPending}>
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConversationPanel({ clientId }: { clientId: number }) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: messages, isLoading, isError, refetch, isFetching } = useListMessages(clientId, {
    query: { queryKey: getListMessagesQueryKey(clientId), refetchInterval: 4000 },
  });
  const sendMessage = useSendMessage();
  const markRead = useMarkMessagesRead();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId) });
    qc.invalidateQueries({ queryKey: ["coach-conversations"] });
    qc.invalidateQueries({ queryKey: getGetCoachUnreadCountQueryKey() });
  };

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
    sendMessage.mutate({ clientId, data: { sender: "coach", content } }, { onSuccess: invalidate });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Conversation header with Assign Task button */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between flex-shrink-0 bg-background">
        <span className="text-sm text-muted-foreground">Conversation</span>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50"
          onClick={() => setAssignOpen(true)}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Assign Task
        </Button>
      </div>

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
        {!isError && messages?.map(m => {
          const mt = (m as any).messageType as string | undefined;
          const task = (m as any).task as ClientTask | null | undefined;

          if ((mt === "task_assigned" || mt === "task_alternative") && task) {
            return (
              <div key={m.id} className="flex justify-start">
                <div className="space-y-1">
                  <TaskCard task={task} messageType={mt} />
                  <p className="text-[10px] text-muted-foreground pl-1">
                    {formatDistanceToNow(parseISO(m.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          }

          if (mt === "task_rejected" && task) {
            return (
              <div key={m.id} className="flex justify-start">
                <div className="space-y-1">
                  <RejectionCard
                    task={task}
                    content={m.content}
                    clientId={clientId}
                    onActionDone={invalidate}
                  />
                  <p className="text-[10px] text-muted-foreground pl-1">
                    {formatDistanceToNow(parseISO(m.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className={cn("flex", m.sender === "coach" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[75%] px-4 py-2 rounded-2xl text-sm", m.sender === "coach" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm")}>
                <p className="leading-relaxed">{m.content}</p>
                <p className={cn("text-[10px] mt-1 opacity-60", m.sender === "coach" ? "text-right" : "text-left")}>
                  {formatDistanceToNow(parseISO(m.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
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

      <AssignTaskDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        clientId={clientId}
        onDone={() => { setAssignOpen(false); invalidate(); }}
      />
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
