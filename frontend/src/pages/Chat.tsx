import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUp, Eraser, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BlockView, type BlockCtx } from "@/components/chat/blocks";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Block, ChatMessage, ChatResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "I spent ₹500 on dinner yesterday",
  "How much did I spend on food this month?",
  "Show my five most expensive expenses",
  "Compare my spending this month with last month",
  "Which category am I spending the most on?",
  "Set my monthly shopping budget to ₹3,000",
  "Am I spending too much on eating out?",
  "Show my expenses from the last seven days",
];

const QUICK = [
  { label: "Add expense", text: "Add ₹" },
  { label: "This month", text: "How much did I spend this month?" },
  { label: "Top expenses", text: "Show my five most expensive expenses" },
  { label: "Compare months", text: "Compare my spending this month with last month" },
  { label: "My budgets", text: "Show my budgets" },
];

const STEPS = ["Understanding your request…", "Checking your transactions…", "Crunching the numbers…", "Putting it together…"];
const MUTATING = new Set(["expense_saved", "expense_updated", "expense_deleted", "budget_status"]);

function Avatar() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm" aria-hidden>
      <Sparkles className="size-4" />
    </span>
  );
}

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-start gap-3 animate-fade-in" role="status" aria-live="polite">
      <Avatar />
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border bg-card px-4 py-3 shadow-card">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((d) => (
            <span key={d} className="size-1.5 rounded-full bg-primary animate-dot-bounce" style={{ animationDelay: `${d * 0.16}s` }} />
          ))}
        </span>
        <span className="text-sm text-muted-foreground">{STEPS[i]}</span>
      </div>
    </div>
  );
}

export default function Chat() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [text, setText] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tempId = useRef(-1);

  const health = useQuery({ queryKey: ["health"], queryFn: () => api.get<{ status: "ok" | "degraded"; llm_configured: boolean; llm_provider: string }>("/health"), staleTime: 60_000 });

  const loadHistory = useCallback(async () => {
    setLoaded(false);
    setHistoryError(null);
    try {
      setMessages(await api.get<ChatMessage[]>("/chat/history"));
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Couldn't load chat history");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const run = useCallback(
    async (body: { message?: string; action?: { type: string; expense_id: number } }, optimistic: string) => {
      const temp: ChatMessage = { id: tempId.current--, role: "user", content: optimistic, blocks: null, created_at: new Date().toISOString() };
      setMessages((m) => [...m, temp]);
      setPending(true);
      try {
        const r = await api.post<ChatResponse>("/chat", body);
        setMessages((m) => [...m.filter((x) => x.id !== temp.id), r.user_message, r.assistant_message]);
        const blocks = r.assistant_message.blocks ?? [];
        if (blocks.some((b: Block) => MUTATING.has(b.type) && (b.type !== "budget_status" || b.action !== "get"))) qc.invalidateQueries();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setMessages((m) => [...m, { id: tempId.current--, role: "assistant", content: "", blocks: [{ type: "error", message: msg }], created_at: new Date().toISOString() }]);
      } finally {
        setPending(false);
        inputRef.current?.focus();
      }
    },
    [qc],
  );

  const send = useCallback(
    (t: string) => {
      const v = t.trim();
      if (!v || pending || !loaded || !!historyError) return;
      setText("");
      void run({ message: v }, v);
    },
    [historyError, loaded, pending, run],
  );

  const onAction = useCallback<BlockCtx["onAction"]>(
    (a) => void run({ action: a }, a.type === "confirm_delete" ? "Yes, delete it." : "No, keep it."),
    [run],
  );

  async function clearChat() {
    try {
      await api.del("/chat/history");
      setMessages([]);
      setClearOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't clear chat");
    }
  }

  const empty = loaded && messages.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card sm:rounded-2xl sm:border sm:shadow-card">
      {/* header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        <Avatar />
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold leading-tight">Penny</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", health.isError || health.data?.status === "degraded" ? "bg-warning" : health.data?.llm_configured === false ? "bg-warning" : "bg-success")} />
            {health.isError ? "Service status unavailable" : health.data?.llm_configured === false ? "AI setup required" : health.data?.status === "degraded" ? "Service connection issue" : "AI finance assistant · online"}
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setClearOpen(true)}>
            <Eraser /> <span className="hidden sm:inline">Clear chat</span>
          </Button>
        )}
      </div>

      {health.data?.llm_configured === false && (
        <div className="flex items-start gap-2.5 border-b border-[#F59E0B]/30 bg-warning-soft px-4 py-2.5 text-[13px] text-[#9A5400]" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            The AI provider isn't configured. Set <code className="font-mono">{health.data.llm_provider === "groq" ? "GROQ_API_KEY" : "OPENAI_API_KEY"}</code> in the backend <code className="font-mono">.env</code> and restart. You can still add expenses manually.
          </p>
        </div>
      )}
      {health.isError && (
        <div className="border-b border-[#F59E0B]/30 bg-warning-soft px-4 py-2.5 text-[13px] text-[#9A5400]" role="status">
          Couldn't check the AI service status. <button className="font-medium underline" onClick={() => void health.refetch()}>Retry</button>
        </div>
      )}

      {/* messages */}
      <div className="scroll-thin flex-1 overflow-y-auto bg-background/60 px-3 py-5 sm:px-6" aria-live="polite">
        {!loaded ? (
          <div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : historyError ? (
          <div className="grid h-full place-items-center">
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium">Couldn't load your conversation.</p>
              <p className="mt-1 text-sm text-muted-foreground">{historyError}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadHistory()}>Try again</Button>
            </div>
          </div>
        ) : empty ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center animate-fade-up">
            <span className="grid size-14 place-items-center rounded-2xl bg-primary text-white shadow-lift"><Sparkles className="size-7" /></span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">Hi, I'm Penny.</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Tell me what you spent, or ask about your spending. I'll do the bookkeeping — and every number I show comes straight from your data.</p>
            <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={pending} className="rounded-xl border bg-card px-4 py-3 text-left text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lift disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((m, idx) => {
              const isLast = idx === messages.length - 1;
              const ctx: BlockCtx = { onSend: send, onAction, isLatest: isLast && !pending, busy: pending };
              if (m.role === "user")
                return (
                  <div key={m.id} className="flex justify-end animate-fade-up">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm sm:max-w-[75%]">{m.content}</p>
                  </div>
                );
              return (
                <div key={m.id} className="flex items-start gap-3">
                  <Avatar />
                  <div className="min-w-0 max-w-[calc(100%-2.75rem)] flex-1 space-y-3 sm:max-w-[640px]">
                    {m.content && <p className="w-fit max-w-full whitespace-pre-wrap rounded-2xl rounded-tl-md border bg-card px-4 py-2.5 text-sm leading-relaxed shadow-card animate-fade-up">{m.content}</p>}
                    {m.blocks?.map((b, i) => (
                      <BlockView key={i} block={b} ctx={ctx} />
                    ))}
                  </div>
                </div>
              );
            })}
            {pending && <Thinking />}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t bg-card px-3 pb-3 pt-2.5 sm:px-5 sm:pb-4">
        <div className="mx-auto max-w-3xl">
          {!empty && (
            <div className="scroll-thin -mx-1 mb-2.5 flex gap-2 overflow-x-auto px-1 pb-1">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  disabled={pending || !loaded || !!historyError}
                  onClick={() => (q.text.endsWith("₹") ? (setText(q.text), inputRef.current?.focus()) : send(q.text))}
                  className="shrink-0 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex items-end gap-2 rounded-2xl border bg-background/70 p-2 transition-shadow focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"
          >
            <textarea
              ref={inputRef}
              value={text}
              rows={1}
              maxLength={2000}
              disabled={!loaded || !!historyError}
              aria-label="Message Penny"
              placeholder="e.g. I spent ₹450 on groceries today"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(text);
                }
              }}
              className="max-h-36 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
            />
            <Button type="submit" size="icon" className="size-9 shrink-0 rounded-xl" disabled={!text.trim() || pending || !loaded || !!historyError} aria-label="Send message">
              {pending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
            </Button>
          </form>
          <p className="mt-2 hidden text-center text-[11px] text-muted-foreground sm:block">Enter to send · Shift+Enter for a new line · Numbers are calculated from your saved data</p>
        </div>
      </div>

      <ConfirmDialog open={clearOpen} onOpenChange={setClearOpen} title="Clear this conversation?" confirmLabel="Clear chat" description={<p className="text-sm text-muted-foreground">Your expenses and budgets are not affected — only the chat history is removed.</p>} onConfirm={clearChat} />
    </div>
  );
}
