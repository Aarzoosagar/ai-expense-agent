import { Loader2, MessageSquareText, PieChart, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

const POINTS = [
  { icon: MessageSquareText, title: "Just say what you spent", text: "“₹500 on dinner yesterday” — saved, categorised and dated for you." },
  { icon: PieChart, title: "Numbers you can trust", text: "Every total is calculated from your data, never guessed by the AI." },
  { icon: ShieldCheck, title: "Private by design", text: "Your transactions are only ever visible to you." },
];

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "register" && !name.trim()) return setError("Please enter your name.");
    if (mode === "register" && password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 size-96 rounded-full bg-primary/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-24 size-96 rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-primary shadow-lift">
            <svg viewBox="0 0 32 32" className="size-6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 22V13.5L16 8l9 5.5V22" />
              <circle cx="16" cy="17" r="2.4" fill="#fff" stroke="none" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">Expense Agent</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight">Talk to your money.</h1>
          <p className="mt-4 text-base leading-relaxed text-white/65">An AI finance assistant that tracks your spending through conversation — and an accurate ledger behind it.</p>
          <ul className="mt-10 space-y-6">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10">
                  <p.icon className="size-5 text-[#B9AEFB]" />
                </span>
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="mt-0.5 text-sm text-white/55">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} AI Expense Agent</p>
      </div>

      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 lg:hidden">
            <span className="text-lg font-semibold tracking-tight text-primary">Expense Agent</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{mode === "login" ? "Sign in to see where your money went." : "Start tracking your spending in under a minute."}</p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            {mode === "register" && (
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha Rao" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-[#B7311F]">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="mt-8 rounded-lg bg-accent px-3 py-2.5 text-center text-xs text-accent-foreground">
            Demo data? Run <code className="font-mono">python -m app.seed</code> then sign in with <b>demo@example.com</b> / <b>demo12345</b>
          </p>
        </div>
      </div>
    </div>
  );
}
