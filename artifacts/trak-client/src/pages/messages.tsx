import { useClientId } from "@/hooks/use-client-id";
import {
  useListMessages,
  useSendMessage,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, MessageCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

const msgSchema = z.object({ content: z.string().min(1) });

export function MessagesPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();

  const { data: messages, isLoading } = useListMessages(clientId!, {
    query: { enabled: !!clientId, queryKey: getListMessagesQueryKey(clientId!) }
  });
  const sendMessage = useSendMessage();

  const form = useForm<z.infer<typeof msgSchema>>({
    resolver: zodResolver(msgSchema),
    defaultValues: { content: "" },
  });

  const onSubmit = (values: z.infer<typeof msgSchema>) => {
    sendMessage.mutate({ clientId: clientId!, data: { sender: "client", content: values.content } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId!) });
        form.reset();
      }
    });
  };

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && <p className="text-muted-foreground text-sm text-center">Loading...</p>}
          {(messages?.length ?? 0) === 0 && !isLoading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm text-center">No messages yet. Say hi to your coach!</p>
            </div>
          )}
          {messages?.map(m => (
            <div key={m.id} data-testid={`msg-${m.id}`} className={`flex ${m.sender === "client" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.sender === "client" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.sender === "coach" && <p className="text-xs font-medium mb-0.5 text-muted-foreground">Coach</p>}
                <p className="text-sm">{m.content}</p>
                <p className={`text-xs mt-1 ${m.sender === "client" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {format(parseISO(m.createdAt), "h:mm a")}
                </p>
              </div>
            </div>
          ))}
        </CardContent>

        <div className="border-t border-border p-3">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem className="flex-1 mb-0">
                  <FormControl>
                    <Input placeholder="Message your coach..." {...field} data-testid="input-message" />
                  </FormControl>
                </FormItem>
              )} />
              <Button type="submit" size="icon" disabled={sendMessage.isPending} data-testid="button-send">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </Form>
        </div>
      </Card>
    </div>
  );
}
