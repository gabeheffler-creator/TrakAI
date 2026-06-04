import { useState } from "react";
import { useListClients, useCreateClient, getListClientsQueryKey, useGenerateInviteLink } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Copy, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { format } from "date-fns";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  goal: z.string().optional(),
});

export function ClientList() {
  const { data: clients, isLoading } = useListClients();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setIsDialogOpen(false);
        form.reset();
        toast({ title: "Client created successfully" });
      },
      onError: () => toast({ title: "Failed to create client", variant: "destructive" }),
    });
  };

  const handleCopyInvite = (clientId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    generateInvite.mutate({ clientId }, {
      onSuccess: (data) => {
        // Assume data contains { url } or we construct it
        // The prompt says: The URL should be /client/<token> in the client app
        const url = `${window.location.origin.replace('coach', 'client')}/client/${data.token}`;
        navigator.clipboard.writeText(url);
        toast({ title: "Invite link copied to clipboard" });
      },
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
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="goal" render={({ field }) => (
                  <FormItem><FormLabel>Goal (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createClient.isPending}>
                  {createClient.isPending ? "Creating..." : "Create Client"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

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
                  <CardTitle className="flex justify-between items-start">
                    <span className="truncate">{client.name}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0 z-10 relative"
                      onClick={(e) => handleCopyInvite(client.id, e)}
                      title="Copy Invite Link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-muted-foreground truncate">{client.email}</div>
                  {client.goal && <div className="text-sm font-medium">Goal: {client.goal}</div>}
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
