import { useState } from "react";
import { useListClients, useCreateClient, getListClientsQueryKey, useGenerateInviteLink, useUpdateClientStatus } from "@workspace/api-client-react";
import type { Client } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Search, UserX, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { format } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  goal: z.string().min(1, "Goal is required"),
});

function ClientCard({ client }: { client: Client }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateStatus = useUpdateClientStatus();
  const isActive = client.status !== "inactive";

  const setStatus = (status: "active" | "inactive") => {
    updateStatus.mutate({ clientId: client.id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        toast({ title: status === "active" ? "Client reactivated" : "Client deactivated" });
      },
      onError: () => toast({ title: "Failed to update client status", variant: "destructive" }),
    });
  };

  return (
    <Card className={cn("h-full transition-colors", isActive ? "hover:border-primary" : "opacity-60 grayscale")}>
      <Link href={`/clients/${client.id}`} className="block cursor-pointer" data-testid={`link-client-${client.id}`}>
        <CardHeader className="pb-2">
          <CardTitle className="truncate text-base">{client.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-2">
          <div className="text-sm text-muted-foreground truncate">{client.email}</div>
          {client.goal && <div className="text-sm font-medium truncate">{client.goal}</div>}
          <div className="text-xs text-muted-foreground mt-4">
            Joined {format(new Date(client.createdAt), "MMM d, yyyy")}
          </div>
        </CardContent>
      </Link>
      <CardContent className="pt-0">
        {isActive ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
              data-testid={`button-deactivate-${client.id}`}
            >
              <UserX className="w-4 h-4 mr-2" /> Deactivate
            </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {client.name} will lose access to the Trak Client app. You'll keep full
                    access to their data, and you can reactivate them anytime — nothing is deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => setStatus("inactive")}
                    data-testid="button-confirm-deactivate"
                  >
                    Yes, deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={updateStatus.isPending}
            onClick={() => setStatus("active")}
            data-testid={`button-reactivate-${client.id}`}
          >
            <UserCheck className="w-4 h-4 mr-2" /> Reactivate
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ClientList() {
  const { data: clients, isLoading, isError, refetch, isFetching } = useListClients();
  const [search, setSearch] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createClient = useCreateClient();
  const generateInvite = useGenerateInviteLink();

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", email: "", phone: "", goal: "" },
  });

  const onSubmit = (values: z.infer<typeof clientSchema>) => {
    createClient.mutate({ data: values }, {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setIsSheetOpen(false);
        form.reset();
        toast({ title: "Client created! Sending invite email…" });
        generateInvite.mutate({ clientId: created.id }, {
          onSuccess: (inv) => {
            // The invite link points to the Trak Client app, not this (coach)
            // app, so it uses the client app's base path, not this app's BASE_URL.
            const inviteUrl = `${window.location.origin}/client/join/${inv.token}`;
            fetch("/api/invite/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientId: created.id, email: values.email, name: values.name, inviteUrl }),
            }).catch(() => null);
          },
        });
      },
      onError: () => toast({ title: "Failed to create client", variant: "destructive" }),
    });
  };

  const filteredClients = clients?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );
  const activeClients = filteredClients?.filter(c => c.status !== "inactive");
  const inactiveClients = filteredClients?.filter(c => c.status === "inactive");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <Button onClick={() => { form.reset(); setIsSheetOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </Button>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto bg-background">
          <SheetHeader className="mb-4">
            <SheetTitle>Add New Client</SheetTitle>
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-8">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. Alex Johnson" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="alex@example.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone <span className="text-muted-foreground">(Optional)</span></FormLabel><FormControl><Input placeholder="+1 555 000 0000" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="goal" render={({ field }) => (
                <FormItem><FormLabel>Primary Goal</FormLabel><FormControl><Input placeholder="e.g. Lose 15 lbs, build strength" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <p className="text-xs text-muted-foreground">An invite link will be emailed automatically after creating.</p>
              <Button type="submit" className="w-full" disabled={createClient.isPending}>
                {createClient.isPending ? "Creating…" : "Create Client & Send Invite"}
              </Button>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <div className="flex items-center space-x-2 bg-card border rounded-md px-3 py-2">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          placeholder="Search clients..." 
          className="border-0 focus-visible:ring-0 shadow-none px-0"
        />
      </div>

      {isLoading ? (
        <div className="p-8 text-center">Loading clients...</div>
      ) : isError ? (
        <QueryErrorState
          message="Couldn't load your clients. This is usually temporary."
          onRetry={() => refetch()}
          isRetrying={isFetching}
          testId="button-retry-clients"
        />
      ) : (
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground">
              Active Clients {activeClients ? `(${activeClients.length})` : ""}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeClients?.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
              {activeClients?.length === 0 && (
                <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg bg-card">
                  No active clients found.
                </div>
              )}
            </div>
          </div>

          {(inactiveClients?.length ?? 0) > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">
                Inactive Clients ({inactiveClients?.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {inactiveClients?.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
