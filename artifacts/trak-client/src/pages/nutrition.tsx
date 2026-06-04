import { useState, useRef } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListNutritionLogs,
  useCreateNutritionLog,
  useDeleteNutritionLog,
  useGetUploadUrl,
  getListNutritionLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, UtensilsCrossed } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NutritionPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [calories, setCalories] = useState("");

  const { data: logs, isLoading } = useListNutritionLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListNutritionLogsQueryKey(clientId!) }
  });
  const createNutritionLog = useCreateNutritionLog();
  const deleteNutritionLog = useDeleteNutritionLog();
  const getUploadUrl = useGetUploadUrl();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile || !clientId) return;
    setUploading(true);
    try {
      getUploadUrl.mutate({ data: { filename: selectedFile.name, contentType: selectedFile.type } }, {
        onSuccess: async (data) => {
          try {
            await fetch(data.uploadUrl, { method: "PUT", body: selectedFile, headers: { "Content-Type": selectedFile.type } });
          } catch {
            // Ignore upload errors for demo
          }
          createNutritionLog.mutate({
            clientId,
            data: {
              date: new Date().toISOString().split("T")[0],
              imageUrl: previewUrl ?? data.publicUrl,
              calories: calories ? parseInt(calories) : undefined,
              notes: notes || undefined,
            }
          }, {
            onSuccess: () => {
              qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId) });
              setDialogOpen(false);
              setSelectedFile(null);
              setPreviewUrl(null);
              setNotes("");
              setCalories("");
              toast({ title: "Nutrition logged!" });
            }
          });
          setUploading(false);
        },
        onError: () => {
          setUploading(false);
          toast({ title: "Upload failed", variant: "destructive" });
        }
      });
    } catch {
      setUploading(false);
    }
  };

  const handleDelete = (id: number) => {
    deleteNutritionLog.mutate({ clientId: clientId!, nutritionId: id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId!) })
    });
  };

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-nutrition"><Plus className="w-4 h-4 mr-1" /> Add Screenshot</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Nutrition Screenshot</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full rounded-lg max-h-48 object-cover" />
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Upload MFP screenshot</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" data-testid="input-nutrition-photo" />
                </label>
              )}
              <div>
                <Label>Calories (optional)</Label>
                <Input type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="e.g. 2100" className="mt-1" />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." className="mt-1" />
              </div>
              <Button className="w-full" onClick={handleUpload} disabled={!selectedFile || uploading} data-testid="button-save-nutrition">
                {uploading ? "Uploading..." : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {(logs?.length ?? 0) === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No nutrition screenshots yet. Upload your MFP diary.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {logs?.slice().reverse().map(n => (
          <Card key={n.id} className="overflow-hidden" data-testid={`card-nutrition-${n.id}`}>
            <div className="relative">
              <img src={n.imageUrl} alt="Nutrition" className="w-full aspect-square object-cover" />
              <button
                onClick={() => handleDelete(n.id)}
                className="absolute top-2 right-2 bg-background/80 rounded-full p-1 text-muted-foreground hover:text-destructive transition-colors"
                data-testid={`button-delete-nutrition-${n.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <CardContent className="p-2">
              <p className="text-xs font-medium">{n.date}</p>
              {n.calories && <p className="text-xs text-muted-foreground">{n.calories} kcal</p>}
              {n.notes && <p className="text-xs text-muted-foreground truncate">{n.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
