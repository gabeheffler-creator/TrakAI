import { useState } from "react";
import { useListClients, useCreateClient, getListClientsQueryKey, useGenerateInviteLink } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { format } from "date-fns";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  goal: z.string().min(1, "Goal is required"),
});

export function ClientList() {
  const { data: clients, isLoading } = useListClients();
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients?.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`} className="block h-full">
              <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="truncate text-base">{client.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-muted-foreground truncate">{client.email}</div>
                  {client.goal && <div className="text-sm font-medium truncate">{client.goal}</div>}
                  <div className="text-xs text-muted-foreground mt-4">
                    Joined {format(new Date(client.createdAt), "MMM d, yyyy")}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {filteredClients?.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg bg-card">
              No clients found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
