import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useClientId } from "@/hooks/use-client-id";
import { useUnitSystem } from "@/hooks/use-unit-system";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Download, CheckCircle2, AlertCircle, Loader2, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── CSV helpers ────────────────────────────────────────────────────────────────

const MEASUREMENT_COLUMNS = ["date", "weight", "body_fat", "waist", "hips", "chest", "arms", "thighs", "notes"];
const MEASUREMENT_TEMPLATE_ROWS = [["date", "weight", "body_fat", "waist", "hips", "chest", "arms", "thighs", "notes"], ["2024-01-15", "185", "18.5", "32", "38", "40", "14", "24", ""]];

function downloadTemplate(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map(line => line.split(",").map(c => c.trim().replace(/^"|"$/g, "")))
    .filter(row => row.some(c => c.length > 0));
}

interface MeasurementRow {
  date: string;
  weight?: number;
  bodyFat?: number;
  waist?: number;
  hips?: number;
  chest?: number;
  arms?: number;
  thighs?: number;
  notes?: string;
  _error?: string;
}

function parseMeasurementRows(rows: string[][]): MeasurementRow[] {
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.toLowerCase().replace(/\s+/g, "_"));
  const idx = (name: string) => header.indexOf(name);
  const num = (v: string | undefined) => {
    if (!v || v === "") return undefined;
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  };

  return rows.slice(1).map(row => {
    const date = row[idx("date")] ?? "";
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return { date, _error: `Invalid date "${date}" — must be YYYY-MM-DD` };
    }
    return {
      date,
      weight: num(row[idx("weight")]),
      bodyFat: num(row[idx("body_fat")]),
      waist: num(row[idx("waist")]),
      hips: num(row[idx("hips")]),
      chest: num(row[idx("chest")]),
      arms: num(row[idx("arms")]),
      thighs: num(row[idx("thighs")]),
      notes: row[idx("notes")] || undefined,
    };
  });
}

// ── Preview table ──────────────────────────────────────────────────────────────

function PreviewTable({ rows, units }: { rows: MeasurementRow[]; units: string }) {
  const w = units === "metric" ? "kg" : "lbs";
  const m = units === "metric" ? "cm" : "in";
  return (
    <div className="overflow-x-auto rounded-xl border border-border text-xs">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Weight ({w})</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">BF%</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Waist ({m})</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Hips ({m})</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn("border-b border-border last:border-0", r._error && "bg-destructive/5")}>
              <td className="px-3 py-2 font-mono">{r.date}</td>
              <td className="px-3 py-2">{r.weight ?? "—"}</td>
              <td className="px-3 py-2">{r.bodyFat ?? "—"}</td>
              <td className="px-3 py-2">{r.waist ?? "—"}</td>
              <td className="px-3 py-2">{r.hips ?? "—"}</td>
              <td className="px-3 py-2">
                {r._error ? (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {r._error}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Valid
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type ImportStatus = "idle" | "importing" | "done" | "error";

export function DataImportPage() {
  const [, setLocation] = useLocation();
  const { clientId } = useClientId();
  const { units } = useUnitSystem();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<MeasurementRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [importedCount, setImportedCount] = useState(0);
  const [dragging, setDragging] = useState(false);

  const validRows = rows.filter(r => !r._error);
  const errorRows = rows.filter(r => r._error);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Please upload a .csv file", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    setStatus("idle");
    setImportedCount(0);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      const measurementRows = parseMeasurementRows(parsed);
      setRows(measurementRows);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!clientId || validRows.length === 0) return;
    setStatus("importing");
    let count = 0;
    for (const row of validRows) {
      try {
        const res = await fetch(`/api/clients/${clientId}/measurements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: row.date,
            weight: row.weight,
            bodyFat: row.bodyFat,
            waist: row.waist,
            hips: row.hips,
            chest: row.chest,
            arms: row.arms,
            thighs: row.thighs,
            notes: row.notes,
            unit: units,
          }),
        });
        if (res.ok) count++;
      } catch {
        // continue on individual failures
      }
    }
    setImportedCount(count);
    setStatus(count > 0 ? "done" : "error");
  };

  const reset = () => {
    setRows([]);
    setFileName(null);
    setStatus("idle");
    setImportedCount(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/settings")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-sm text-muted-foreground mt-1">Bulk-import historical measurements from a CSV file</p>
      </div>

      {/* Measurements section */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Body Measurements</p>
              <p className="text-xs text-muted-foreground">Weight, body fat %, and circumferences</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs"
            onClick={() => downloadTemplate("measurements_template.csv", MEASUREMENT_TEMPLATE_ROWS)}
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Column legend */}
          <div className="flex flex-wrap gap-1.5">
            {MEASUREMENT_COLUMNS.map(c => (
              <span key={c} className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-mono text-muted-foreground">
                {c}
              </span>
            ))}
          </div>

          {/* Drop zone */}
          {!fileName ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 py-10 cursor-pointer transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
              )}
            >
              <Upload className={cn("w-8 h-8", dragging ? "text-primary" : "text-muted-foreground/40")} strokeWidth={1.5} />
              <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground">Accepts .csv files only</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* File badge + clear */}
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{fileName}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {rows.length} row{rows.length !== 1 ? "s" : ""} parsed
                  </span>
                </div>
                <button onClick={reset} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Validation summary */}
              {errorRows.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{errorRows.length} row{errorRows.length !== 1 ? "s" : ""} with errors will be skipped. {validRows.length} valid rows will be imported.</span>
                </div>
              )}

              {/* Preview table */}
              {rows.length > 0 && <PreviewTable rows={rows} units={units} />}

              {/* Done state */}
              {status === "done" && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{importedCount} measurement{importedCount !== 1 ? "s" : ""} imported!</p>
                    <p className="text-xs opacity-80">Check the Stats or Progress pages to see your data.</p>
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">Import failed. Check your CSV format and try again.</p>
                </div>
              )}

              {/* Action buttons */}
              {status !== "done" && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    disabled={validRows.length === 0 || status === "importing"}
                    onClick={handleImport}
                  >
                    {status === "importing" ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Import {validRows.length} row{validRows.length !== 1 ? "s" : ""}</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={reset} disabled={status === "importing"}>
                    Clear
                  </Button>
                </div>
              )}

              {status === "done" && (
                <Button variant="outline" className="w-full" onClick={() => setLocation("/stats")}>
                  View in Stats
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-semibold">Tips for a clean import</p>
        <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
          <li>Download the template above to get the correct column headers</li>
          <li>Dates must be in <span className="font-mono">YYYY-MM-DD</span> format (e.g. 2024-03-15)</li>
          <li>Use your currently selected unit system ({units}) for all values</li>
          <li>Leave columns empty if you don't have that measurement</li>
          <li>Duplicate dates are allowed — each row creates a separate entry</li>
        </ul>
      </div>
    </div>
  );
}
