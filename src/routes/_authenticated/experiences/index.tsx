import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/experiences/")({
  head: () => ({
    meta: [
      { title: "Interview experiences — PlacementCamp" },
      {
        name: "description",
        content:
          "Search approved interview write-ups by company, role, college and year, with rounds and questions.",
      },
      { property: "og:title", content: "Interview experiences — PlacementCamp" },
      {
        property: "og:description",
        content: "Approved interview write-ups from students, searchable by company and role.",
      },
    ],
  }),
  component: ExperiencesPage,
});

function ExperiencesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [year, setYear] = useState("all");
  const [company, setCompany] = useState("all");
  const [college, setCollege] = useState("all");

  const query = useQuery({
    queryKey: ["experiences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interview_experiences")
        .select(
          "id, company, role_title, college, year, outcome, status, created_at, author_id, rounds, questions, featured, is_anonymous, interview_date",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (query.isLoading) return <LoadingState rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const all = query.data ?? [];
  const approved = all.filter((e) => e.status === "approved");
  const mine = all.filter((e) => e.author_id === user?.id && e.status !== "approved");

  const years = [...new Set(approved.map((e) => e.year).filter(Boolean))].sort(
    (a, b) => Number(b) - Number(a),
  );
  const companies = [...new Set(approved.map((e) => e.company))].sort();
  const colleges = [...new Set(approved.map((e) => e.college).filter(Boolean) as string[])].sort();

  const term = search.trim().toLowerCase();
  const filtered = approved
    .filter((e) => {
      const rounds = (e.rounds as unknown as { name?: string; detail?: string }[]) ?? [];
      const haystack = [
        e.company,
        e.role_title,
        e.college ?? "",
        e.questions ?? "",
        ...rounds.flatMap((r) => [r.name ?? "", r.detail ?? ""]),
      ];
      if (term && !haystack.some((v) => v.toLowerCase().includes(term))) return false;
      if (outcome !== "all" && e.outcome !== outcome) return false;
      if (year !== "all" && String(e.year) !== year) return false;
      if (company !== "all" && e.company !== company) return false;
      if (college !== "all" && e.college !== college) return false;
      return true;
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured));

  return (
    <div>
      <PageHeader
        title="Interview experiences"
        description="Approved write-ups from students who sat the drives."
        action={
          <Button asChild>
            <Link to="/experiences/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Share yours
            </Link>
          </Button>
        }
      />

      {mine.length > 0 ? (
        <section className="mb-6 rounded-2xl border bg-accent/30 p-5">
          <h2 className="text-sm font-semibold">Your submissions</h2>
          <ul className="mt-3 space-y-2">
            {mine.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <Link to="/experiences/$id" params={{ id: e.id }} className="hover:underline">
                  {e.company} — {e.role_title}
                </Link>
                <span className="flex items-center gap-2">
                  <Badge variant={e.status === "rejected" ? "destructive" : "secondary"}>
                    {e.status === "pending" ? "awaiting review" : e.status}
                  </Badge>
                  {e.status === "pending" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/experiences/edit/$id" params={{ id: e.id }}>
                        Edit
                      </Link>
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search company, role, college, rounds or questions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search experiences"
        />
        <Select value={company} onValueChange={setCompany}>
          <SelectTrigger aria-label="Filter by company">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={college} onValueChange={setCollege}>
          <SelectTrigger aria-label="Filter by college">
            <SelectValue placeholder="College" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All colleges</SelectItem>
            {colleges.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger aria-label="Filter by outcome">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="selected">Selected</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="in_process">In process</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger aria-label="Filter by year">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        {filtered.length === 0 ? (
          <EmptyState
            title={approved.length === 0 ? "No experiences published yet" : "No matches"}
            description={
              approved.length === 0
                ? "Be the first to share how your interview went — it gets published once an admin approves it."
                : "Try a different company, outcome or year."
            }
            action={
              approved.length === 0 ? (
                <Button asChild>
                  <Link to="/experiences/new">Share your experience</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {filtered.map((e) => (
              <li key={e.id}>
                <Link
                  to="/experiences/$id"
                  params={{ id: e.id }}
                  className="block rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-soft)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{e.company}</h2>
                      <p className="text-sm text-muted-foreground">{e.role_title}</p>
                    </div>
                    <Badge
                      variant={
                        e.outcome === "selected"
                          ? "default"
                          : e.outcome === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {e.outcome.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {[e.college, e.year, `${(e.rounds as unknown[])?.length ?? 0} rounds`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
