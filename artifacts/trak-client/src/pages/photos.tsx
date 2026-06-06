import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListProgressPhotos,
  useCreateProgressPhoto,
  useDeleteProgressPhoto,
  useListNutritionLogs,
  useDeleteNutritionLog,
  useGetUploadUrl,
  getListProgressPhotosQueryKey,
  getListNutritionLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, Camera, UtensilsCrossed } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function UploadDialog({
  title,
  trigger,
  onSave,
  extraFields,
}: {
  title: string;
  trigger: React.ReactNode;
  onSave: (file: File, notes: string) => void;
  extraFields?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    if (!selectedFile) return;
    onSave(selectedFile, notes);
    setOpen(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-full rounded-lg max-h-64 object-cover" />
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Tap to choose a photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); }
                }}
              />
            </label>
          )}
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Front view, week 8" className="mt-1" />
          </div>
          {extraFields}
          <Button className="w-full" onClick={handleSave} disabled={!selectedFile}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PhotosPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: photos, isLoading: photosLoading } = useListProgressPhotos(clientId!, {
    query: { enabled: !!clientId, queryKey: getListProgressPhotosQueryKey(clientId!) }
  });
  const { data: nutritionLogs, isLoading: nutritionLoading } = useListNutritionLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListNutritionLogsQueryKey(clientId!) }
  });

  const createPhoto = useCreateProgressPhoto();
  const deletePhoto = useDeleteProgressPhoto();
  const deleteNutrition = useDeleteNutritionLog();
  const getUploadUrl = useGetUploadUrl();

  const handleUpload = (file: File, notes: string, onSuccess: (url: string) => void) => {
    getUploadUrl.mutate({ data: { filename: file.name, contentType: file.type } }, {
      onSuccess: async (data) => {
        try {
          await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        } catch { /* ignore */ }
        onSuccess(data.publicUrl ?? URL.createObjectURL(file));
      },
      onError: () => toast({ title: "Upload failed", variant: "destructive" }),
    });
  };

  const handleSaveProgressPhoto = (file: File, notes: string) => {
    handleUpload(file, notes, (url) => {
      createPhoto.mutate({
        clientId: clientId!,
        data: { date: new Date().toISOString().split("T")[0], imageUrl: url, notes: notes || undefined }
      }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListProgressPhotosQueryKey(clientId!) });
          toast({ title: "Progress photo saved!" });
        }
      });
    });
  };

  const mfpPhotos = nutritionLogs?.filter(n => n.imageUrl && n.imageUrl !== "cant_track") ?? [];

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-8 pb-8">
      {/* ── MFP Diary Photos ─────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">MFP Diary Photos</h2>
            <p className="text-xs text-muted-foreground">Screenshots uploaded from your nutrition log</p>
          </div>
        </div>

        {nutritionLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

        {!nutritionLoading && mfpPhotos.length === 0 && (
          <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-2xl">
            <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No MFP screenshots yet. Upload from the Nutrition tab.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {mfpPhotos.slice().reverse().map(n => (
            <Card key={n.id} className="overflow-hidden">
              <div className="relative">
                <img src={n.imageUrl} alt="MFP" className="w-full aspect-square object-cover" />
                <button
                  onClick={() => deleteNutrition.mutate({ clientId: clientId!, nutritionId: n.id }, {
                    onSuccess: () => qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId!) })
                  })}
                  className="absolute top-2 right-2 bg-background/80 rounded-full p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <CardContent className="p-2">
                <p className="text-xs font-medium">{n.date}</p>
                {n.notes && <p className="text-xs text-muted-foreground truncate">{n.notes}</p>}
                {n.calories && <p className="text-xs text-muted-foreground">{n.calories} kcal</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Progress Photos ───────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Progress Photos</h2>
            <p className="text-xs text-muted-foreground">Document your physique over time</p>
          </div>
          <UploadDialog
            title="Upload Progress Photo"
            trigger={
              <Button size="sm" className="gap-1">
                <Plus className="w-4 h-4" /> Add
              </Button>
            }
            onSave={handleSaveProgressPhoto}
          />
        </div>

        {photosLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

        {!photosLoading && (photos?.length ?? 0) === 0 && (
          <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-2xl">
            <Camera className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No progress photos yet. Start documenting your journey!</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {photos?.slice().reverse().map(p => (
            <Card key={p.id} className="overflow-hidden">
              <div className="relative">
                <img src={p.imageUrl} alt="Progress" className="w-full aspect-[3/4] object-cover" />
                <button
                  onClick={() => deletePhoto.mutate({ clientId: clientId!, photoId: p.id }, {
                    onSuccess: () => qc.invalidateQueries({ queryKey: getListProgressPhotosQueryKey(clientId!) })
                  })}
                  className="absolute top-2 right-2 bg-background/80 rounded-full p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <CardContent className="p-2">
                <p className="text-xs font-medium">{p.date}</p>
                {p.notes && <p className="text-xs text-muted-foreground truncate">{p.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
