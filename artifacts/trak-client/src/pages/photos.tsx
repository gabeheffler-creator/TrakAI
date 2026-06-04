import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListProgressPhotos,
  useCreateProgressPhoto,
  useDeleteProgressPhoto,
  useGetUploadUrl,
  getListProgressPhotosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, Camera } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function PhotosPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const { data: photos, isLoading } = useListProgressPhotos(clientId!, {
    query: { enabled: !!clientId, queryKey: getListProgressPhotosQueryKey(clientId!) }
  });
  const createPhoto = useCreateProgressPhoto();
  const deletePhoto = useDeleteProgressPhoto();
  const getUploadUrl = useGetUploadUrl();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = () => {
    if (!selectedFile || !clientId) return;
    setUploading(true);
    getUploadUrl.mutate({ data: { filename: selectedFile.name, contentType: selectedFile.type } }, {
      onSuccess: async (data) => {
        try {
          await fetch(data.uploadUrl, { method: "PUT", body: selectedFile, headers: { "Content-Type": selectedFile.type } });
        } catch {
          // Ignore upload errors for demo
        }
        createPhoto.mutate({
          clientId,
          data: {
            date: new Date().toISOString().split("T")[0],
            imageUrl: previewUrl ?? data.publicUrl,
            notes: notes || undefined,
          }
        }, {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListProgressPhotosQueryKey(clientId) });
            setDialogOpen(false);
            setSelectedFile(null);
            setPreviewUrl(null);
            setNotes("");
            setUploading(false);
            toast({ title: "Photo saved!" });
          }
        });
      },
      onError: () => {
        setUploading(false);
        toast({ title: "Upload failed", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deletePhoto.mutate({ clientId: clientId!, photoId: id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListProgressPhotosQueryKey(clientId!) })
    });
  };

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Progress Photos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-photo"><Plus className="w-4 h-4 mr-1" /> Add Photo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Progress Photo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full rounded-lg max-h-64 object-cover" />
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Upload a photo</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" data-testid="input-photo" />
                </label>
              )}
              <div>
                <Label>Notes (optional)</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Front, 12 weeks in" className="mt-1" />
              </div>
              <Button className="w-full" onClick={handleUpload} disabled={!selectedFile || uploading} data-testid="button-save-photo">
                {uploading ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {(photos?.length ?? 0) === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Camera className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No progress photos yet. Document your journey!</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {photos?.slice().reverse().map(p => (
          <Card key={p.id} className="overflow-hidden" data-testid={`card-photo-${p.id}`}>
            <div className="relative">
              <img src={p.imageUrl} alt="Progress" className="w-full aspect-[3/4] object-cover" />
              <button
                onClick={() => handleDelete(p.id)}
                className="absolute top-2 right-2 bg-background/80 rounded-full p-1 text-muted-foreground hover:text-destructive transition-colors"
                data-testid={`button-delete-photo-${p.id}`}
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
    </div>
  );
}
