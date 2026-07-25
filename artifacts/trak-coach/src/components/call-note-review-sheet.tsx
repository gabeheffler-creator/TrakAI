import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Pencil, Trash2, Loader2, CalendarDays, User } from "lucide-react";
import { format } from "date-fns";

interface CallNoteReviewSheetProps {
  open: boolean;
  clientName: string;
  date: string; // ISO yyyy-MM-dd
  callLogId: number;
  onApprove: (note: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

export function CallNoteReviewSheet({
  open,
  clientName,
  date,
  callLogId,
  onApprove,
  onDelete,
  onClose,
}: CallNoteReviewSheetProps) {
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset state when sheet opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setNote("");
      setEditing(false);
      onClose();
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await onApprove(note);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const formattedDate = (() => {
    try { return format(new Date(date + "T12:00:00"), "MMMM d, yyyy"); } catch { return date; }
  })();

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-safe">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left">Review call note</SheetTitle>
        </SheetHeader>

        {/* Placement context */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary" className="flex items-center gap-1.5 text-xs font-normal">
            <User className="w-3 h-3" />
            {clientName}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1.5 text-xs font-normal">
            <CalendarDays className="w-3 h-3" />
            {formattedDate} · Call log #{callLogId}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground mb-2">
          {editing
            ? "Edit the note below, then press Save changes."
            : "This note will be saved to the client's call log. Approve it, edit it, or delete it."}
        </p>

        {/* Note textarea */}
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          readOnly={!editing}
          placeholder={editing ? "Type your note here…" : "No note content yet — click Edit note to add one."}
          className={[
            "min-h-[120px] text-sm mb-5 resize-none transition-colors",
            !editing && "bg-muted/40 text-muted-foreground cursor-default focus-visible:ring-0",
          ].filter(Boolean).join(" ")}
        />

        {/* Actions */}
        {editing ? (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleApprove}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Save changes
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleApprove}
              disabled={saving || deleting}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => { setEditing(true); }}
              disabled={saving || deleting}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit note
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
