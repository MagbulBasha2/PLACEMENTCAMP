import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookMarked,
  Building2,
  CalendarCheck,
  GraduationCap,
  ListChecks,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import heroImage from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/lib/auth";
import { contactSchema, submitContactMessage } from "@/lib/public.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlacementCamp — Campus placement prep that tracks itself" },
      {
        name: "description",
        content:
          "PlacementCamp gives Indian college students a structured placement roadmap, timed aptitude practice, daily challenges and real interview experiences — with progress tracked automatically.",
      },
      { property: "og:title", content: "PlacementCamp — Campus placement prep for students" },
      {
        property: "og:description",
        content:
          "Structured roadmap, timed aptitude practice, daily challenges and verified interview experiences from your seniors.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ListChecks,
    title: "A roadmap you can actually finish",
    body: "Modules, topics and problems arranged in the order companies test them. Mark progress, set your own deadlines, and see exactly what's left.",
  },
  {
    icon: Timer,
    title: "Timed aptitude practice",
    body: "Sit real timed sets, get instant scoring, then review every answer with explanations. Topic-wise accuracy shows where to spend your next hour.",
  },
  {
    icon: CalendarCheck,
    title: "A daily challenge",
    body: "One curated question every day, published by the PlacementCamp team. Small, consistent reps beat weekend cramming.",
  },
  {
    icon: Building2,
    title: "Interview experiences",
    body: "Searchable write-ups by company, role, college and year — rounds, questions asked and outcomes, reviewed before they go live.",
  },
  {
    icon: BarChart3,
    title: "Progress that is real",
    body: "Every number on your dashboard is computed from what you have actually solved and attempted. No vanity stats.",
  },
  {
    icon: BookMarked,
    title: "Bookmarks that stay put",
    body: "Save tricky problems, aptitude questions and interview write-ups to one revision list you can open the night before.",
  },
];

const faqs = [
  {
    q: "Who is PlacementCamp for?",
    a: "Students at Indian colleges preparing for on-campus and off-campus placement drives — from second year onwards. It works whether you are targeting service companies, product companies or core roles.",
  },
  {
    q: "Is there any content already inside?",
    a: "Content is added by the PlacementCamp admin team, so what you see is always curated rather than scraped. If a section looks empty, it means new material is being prepared for it.",
  },
  {
    q: "Can I share my own interview experience?",
    a: "Yes. Any signed-in student can submit an experience. It goes to the review queue first, and appears in the public directory once an admin approves it.",
  },
  {
    q: "Is my data private?",
    a: "Your progress, attempts, bookmarks and uploads are visible only to you. Access rules are enforced in the database itself, not just in the app.",
  },
  {
    q: "Does it cost anything?",
    a: "Creating an account and using the roadmap, aptitude practice and interview directory is free while we are building out the library.",
  },
];

function Landing() {
  const { session } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" aria-hidden />
            </span>
            PlacementCamp
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
            <a href="#contact" className="hover:text-foreground">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="surface-gradient border-b">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                Built for Indian campus placements
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
                Stop collecting PDFs.{" "}
                <span className="text-gradient">Start finishing a plan.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                PlacementCamp turns placement prep into one tracked plan: a structured
                DSA-and-core roadmap, timed aptitude sets with answer review, a daily challenge,
                and interview experiences written by students who sat the same drives.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to={session ? "/dashboard" : "/auth"}>
                    {session ? "Go to dashboard" : "Create your free account"}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#features">See what's inside</a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Email verification included. Your progress is private to you.
              </p>
            </div>
            <div className="relative">
              <img
                src={heroImage}
                alt="Illustration of placement progress tracking, charts and checklists"
                width={1408}
                height={1008}
                className="w-full rounded-2xl"
              />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold">Everything the prep spreadsheet never did</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Six things students ask for every placement season, in one place and tied to your
            actual account.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="border-y bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="text-3xl font-bold">How students use it</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Set up your profile",
                  body: "Add your college, branch and graduation year so your plan matches your drive season.",
                },
                {
                  step: "02",
                  title: "Work the roadmap daily",
                  body: "Pick the next topic, mark problems as in progress or done, and add deadlines you can keep.",
                },
                {
                  step: "03",
                  title: "Practise and review",
                  body: "Take timed aptitude sets, read the explanations, and check your topic accuracy before the next drive.",
                },
              ].map((s) => (
                <div key={s.step} className="rounded-2xl border bg-card p-6">
                  <span className="font-display text-sm font-semibold text-primary">{s.step}</span>
                  <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="text-3xl font-bold">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-8">
            {faqs.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section id="contact" className="border-t bg-secondary/40">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 py-20 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold">Talk to us</h2>
              <p className="mt-3 text-muted-foreground">
                Placement cell, coding club or student — if you want content added for your
                college, or something isn't working, send a message and we'll read it.
              </p>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} PlacementCamp</span>
          <Link to="/auth" className="hover:text-foreground">
            Student sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}

function ContactForm() {
  const send = useServerFn(submitContactMessage);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = contactSchema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      subject: fd.get("subject"),
      message: fd.get("message"),
    });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? "form");
        if (!out[k]) out[k] = i.message;
      }
      setErrors(out);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await send({ data: parsed.data });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDone(true);
      toast.success("Message sent. We'll get back to you.");
    } catch {
      toast.error("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="text-base font-semibold">Thanks — message received</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          We read every message and usually reply within two working days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-6" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="c-name">Name</Label>
        <Input id="c-name" name="name" aria-invalid={!!errors["name"]} />
        {errors["name"] ? (
          <p className="text-xs font-medium text-destructive">{errors["name"]}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-email">Email</Label>
        <Input id="c-email" name="email" type="email" aria-invalid={!!errors["email"]} />
        {errors["email"] ? (
          <p className="text-xs font-medium text-destructive">{errors["email"]}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-subject">Subject (optional)</Label>
        <Input id="c-subject" name="subject" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-message">Message</Label>
        <Textarea id="c-message" name="message" rows={5} aria-invalid={!!errors["message"]} />
        {errors["message"] ? (
          <p className="text-xs font-medium text-destructive">{errors["message"]}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
