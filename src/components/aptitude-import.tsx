import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { LabeledField } from "@/components/labeled-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { downloadFile, readRows, toCsv } from "@/lib/csv";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["content_status"];
type Difficulty = Database["public"]["Enums"]["difficulty_level"];

const HEADERS = [
  "topic",
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_option",
  "explanation",
  "difficulty",
  "tags",
  "time_limit_seconds",
  "source",
  "status",
];

const SAMPLE = [
  "Percentages",
  "A shop raises a price by 20% and then offers 20% off. What is the net change?",
  "4% increase",
  "4% decrease",
  "No change",
  "2% decrease",
  "B",
  "1.2 x 0.8 = 0.96, so the price falls by 4%.",
  "easy",
  "percentages|profit-loss",
  "60",
  "Original question",
  "published",
];

type Row = {
  line: number;
  ok: boolean;
  problem?: string;
  preview?: string;
  payload?: {
    topic_id: string;
    question: string;
    options: string[];
    correct_index: number;
    explanation: string | null;
    difficulty: Difficulty;
    tags: string[];
    time_limit_seconds: number | null;
    source: string | null;
    status: Status;
  };
};

export function AptitudeImportDialog({
  open,
  onOpenChange,
  topics,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: { id: string; name: string }[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState<Status>("draft");
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setRows(null);
    try {
      const raw = await readRows(file);
      if (raw.length === 0) {
        setError("That file has no rows.");
        return;
      }
      const existing = await supabase.from("aptitude_questions").select("topic_id, question");
      const existingKeys = new Set(
        (existing.data ?? []).map((q) => `${q.topic_id}:${normalise(q.question)}`),
      );
      const seen = new Set<string>();

      const parsed: Row[] = raw.map((r, i) => {
        const line = i + 2;
        const topicName = (r["topic"] ?? "").trim();
        const matches = topics.filter(
          (t) => t.id === topicName || t.name.toLowerCase() === topicName.toLowerCase(),
        );
        if (matches.length !== 1)
          return {
            line,
            ok: false,
            problem: matches.length === 0 ? `No topic called "${topicName}"` : "Topic name is ambiguous",
          };

        const question = (r["question"] ?? "").trim();
        if (question.length < 5) return { line, ok: false, problem: "Question text is missing" };

        const options = (
          r["options"]
            ? r["options"].split("|")
            : [r["option_a"], r["option_b"], r["option_c"], r["option_d"], r["option_e"]]
        )
          .map((o) => (o ?? "").trim())
          .filter(Boolean);
        if (options.length < 2) return { line, ok: false, problem: "Add at least two options" };

        const answer = (r["correct_option"] ?? r["correct_index"] ?? "").trim().toUpperCase();
        let correct = -1;
        if (/^[A-E]$/.test(answer)) correct = answer.charCodeAt(0) - 65;
        else if (/^\d+$/.test(answer)) correct = Number(answer) >= options.length ? -1 : Number(answer);
        else correct = options.findIndex((o) => o.toLowerCase() === answer.toLowerCase());
        if (correct < 0 || correct >= options.length)
          return { line, ok: false, problem: "correct_option must match one of the options" };

        const key = `${matches[0]!.id}:${normalise(question)}`;
        if (existingKeys.has(key)) return { line, ok: false, problem: "This question already exists" };
        if (seen.has(key)) return { line, ok: false, problem: "Duplicate row in this file" };
        seen.add(key);

        const diff = (r["difficulty"] ?? "").toLowerCase();
        const rowStatus = (r["status"] ?? "").toLowerCase().replace(/[\s-]/g, "_");

        return {
          line,
          ok: true,
          preview: question.slice(0, 90),
          payload: {
            topic_id: matches[0]!.id,
            question,
            options,
            correct_index: correct,
            explanation: (r["explanation"] ?? "").trim() || null,
            difficulty: (["easy", "medium", "hard"].includes(diff) ? diff : "easy") as Difficulty,
            tags: (r["tags"] ?? "")
              .split(/[|,]/)
              .map((t) => t.trim())
              .filter(Boolean),
            time_limit_seconds: Number(r["time_limit_seconds"] ?? "") || null,
            source: (r["source"] ?? "").trim() || null,
            status: (["draft", "pending_review", "published", "archived"].includes(rowStatus)
              ? rowStatus
              : status) as Status,
          },
        };
      });
      setRows(parsed);
    } catch (e) {
      setError((e as Error).message || "Couldn't read that file.");
    }
  }

  const runImport = useMutation({
    mutationFn: async () => {
      const valid = (rows ?? []).filter((r) => r.ok && r.payload);
      if (valid.length === 0) throw new Error("There are no valid rows to import.");
      const payloads = valid.map((r) => ({
        ...r.payload!,
        options: r.payload!.options as never,
        created_by: user!.id,
      }));
      const { error: insertError } = await supabase
        .from("aptitude_questions")
        .insert(payloads as never[]);
      if (insertError) throw insertError;
      await logAdminAction({
        actorId: user!.id,
        action: "bulk_import",
        entityType: "aptitude_question",
        entityId: null,
        details: { count: payloads.length },
      });
      return payloads.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} questions imported`);
      setRows(null);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["admin-apt-questions"] });
    },
    onError: (e) => setError((e as Error).message || "Import failed."),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setRows(null);
          setError("");
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import aptitude questions</DialogTitle>
          <DialogDescription>
            Upload your own CSV or JSON. Every row is validated and checked for duplicates before
            anything is saved. Only published questions reach students.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadFile(
                  "placementcamp-aptitude-template.csv",
                  toCsv(HEADERS, [SAMPLE]),
                  "text/csv",
                )
              }
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              CSV template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadFile(
                  "placementcamp-aptitude-template.json",
                  JSON.stringify(
                    [Object.fromEntries(HEADERS.map((h, i) => [h, SAMPLE[i]]))],
                    null,
                    2,
                  ),
                  "application/json",
                )
              }
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              JSON template
            </Button>
          </div>

          <LabeledField label="Default status for rows without one">
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_review">Pending review</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </LabeledField>

          <LabeledField label="Choose a CSV or JSON file">
            <Input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </LabeledField>

          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create at least one topic first — the file matches rows by topic name.
            </p>
          ) : null}

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          {rows ? (
            <div className="rounded-xl border">
              <div className="border-b px-4 py-2 text-sm font-medium">
                {rows.filter((r) => r.ok).length} valid · {rows.filter((r) => !r.ok).length} skipped
              </div>
              <ul className="max-h-64 divide-y overflow-y-auto text-sm">
                {rows.map((r) => (
                  <li key={r.line} className="flex items-start gap-3 px-4 py-2">
                    <span className="w-12 shrink-0 text-xs text-muted-foreground">row {r.line}</span>
                    {r.ok ? (
                      <span className="min-w-0">
                        <span className="block truncate">{r.preview}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.payload!.options.length} options · {r.payload!.difficulty} ·{" "}
                          {r.payload!.status.replace("_", " ")}
                        </span>
                      </span>
                    ) : (
                      <span className="text-destructive">{r.problem}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={runImport.isPending || !rows || rows.filter((r) => r.ok).length === 0}
            onClick={() => runImport.mutate()}
          >
            {runImport.isPending
              ? "Importing…"
              : `Import ${(rows ?? []).filter((r) => r.ok).length} questions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function normalise(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
