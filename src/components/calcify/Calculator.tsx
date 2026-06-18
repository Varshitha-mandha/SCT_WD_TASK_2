import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator as CalcIcon,
  Check,
  Copy,
  Delete,
  Equal,
  History,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { type AngleMode, evaluate, formatNumber, prettyExpr } from "@/lib/calc";
import { cn } from "@/lib/utils";

type HistoryItem = { id: string; expression: string; result: string };
type Mode = "standard" | "scientific";

const LS_HISTORY = "calcify:history";
const LS_THEME = "calcify:theme";
const LS_MODE = "calcify:mode";
const LS_ANGLE = "calcify:angle";
const LS_MEMORY = "calcify:memory";

type KeyKind = "num" | "operator" | "equals" | "function" | "sci" | "memory";
type KeyDef = {
  label: React.ReactNode;
  value: string;
  kind?: KeyKind;
  span?: 2;
  ariaLabel?: string;
};

// Standard keypad
const STANDARD_KEYS: KeyDef[] = [
  { label: "AC", value: "AC", kind: "function" },
  { label: "+/−", value: "NEG", kind: "function", ariaLabel: "Toggle sign" },
  { label: "%", value: "%", kind: "function" },
  { label: "÷", value: "/", kind: "operator" },
  { label: "7", value: "7", kind: "num" },
  { label: "8", value: "8", kind: "num" },
  { label: "9", value: "9", kind: "num" },
  { label: "×", value: "*", kind: "operator" },
  { label: "4", value: "4", kind: "num" },
  { label: "5", value: "5", kind: "num" },
  { label: "6", value: "6", kind: "num" },
  { label: "−", value: "-", kind: "operator" },
  { label: "1", value: "1", kind: "num" },
  { label: "2", value: "2", kind: "num" },
  { label: "3", value: "3", kind: "num" },
  { label: "+", value: "+", kind: "operator" },
  { label: "0", value: "0", kind: "num", span: 2 },
  { label: ".", value: ".", kind: "num" },
  { label: <Equal className="h-5 w-5 mx-auto" />, value: "=", kind: "equals" },
];

// Scientific keypad — 6 cols, mobile-friendly
const SCI_KEYS: KeyDef[] = [
  // Memory row
  { label: "MC", value: "MC", kind: "memory" },
  { label: "MR", value: "MR", kind: "memory" },
  { label: "M+", value: "M+", kind: "memory" },
  { label: "M−", value: "M-", kind: "memory" },
  { label: "MS", value: "MS", kind: "memory" },
  { label: "AC", value: "AC", kind: "function" },
  // Functions row 1
  { label: "sin", value: "sin(", kind: "sci" },
  { label: "cos", value: "cos(", kind: "sci" },
  { label: "tan", value: "tan(", kind: "sci" },
  { label: "log", value: "log(", kind: "sci" },
  { label: "ln", value: "ln(", kind: "sci" },
  { label: "(", value: "(", kind: "function" },
  // Functions row 2
  { label: "sin⁻¹", value: "asin(", kind: "sci" },
  { label: "cos⁻¹", value: "acos(", kind: "sci" },
  { label: "tan⁻¹", value: "atan(", kind: "sci" },
  { label: "eˣ", value: "exp(", kind: "sci" },
  { label: "|x|", value: "abs(", kind: "sci" },
  { label: ")", value: ")", kind: "function" },
  // Functions row 3
  { label: "x²", value: "^2", kind: "sci" },
  { label: "x³", value: "^3", kind: "sci" },
  { label: "xʸ", value: "^", kind: "sci" },
  { label: "√", value: "sqrt(", kind: "sci" },
  { label: "1/x", value: "RECIP", kind: "sci" },
  { label: "n!", value: "!", kind: "sci" },
  // Constants + ops
  { label: "π", value: "pi", kind: "sci" },
  { label: "e", value: "e", kind: "sci" },
  { label: "mod", value: " mod ", kind: "sci" },
  { label: "+/−", value: "NEG", kind: "function" },
  { label: "%", value: "%", kind: "function" },
  { label: "÷", value: "/", kind: "operator" },
  // Number block
  { label: "7", value: "7", kind: "num" },
  { label: "8", value: "8", kind: "num" },
  { label: "9", value: "9", kind: "num" },
  { label: "×", value: "*", kind: "operator" },
  { label: "−", value: "-", kind: "operator" },
  { label: "+", value: "+", kind: "operator" },
  { label: "4", value: "4", kind: "num" },
  { label: "5", value: "5", kind: "num" },
  { label: "6", value: "6", kind: "num" },
  { label: "1", value: "1", kind: "num" },
  { label: "2", value: "2", kind: "num" },
  { label: "3", value: "3", kind: "num" },
  { label: "0", value: "0", kind: "num", span: 2 },
  { label: ".", value: ".", kind: "num" },
  { label: <Equal className="h-5 w-5 mx-auto" />, value: "=", kind: "equals", span: 2 },
];

export function Calculator() {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string>("0");
  const [error, setError] = useState<string | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mode, setMode] = useState<Mode>("standard");
  const [angle, setAngle] = useState<AngleMode>("deg");
  const [memory, setMemory] = useState<number>(0);
  const [showHistory, setShowHistory] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initial load from storage
  useEffect(() => {
    try {
      const t = localStorage.getItem(LS_THEME) as "light" | "dark" | null;
      if (t) setTheme(t);
      const m = localStorage.getItem(LS_MODE) as Mode | null;
      if (m) setMode(m);
      const a = localStorage.getItem(LS_ANGLE) as AngleMode | null;
      if (a) setAngle(a);
      const mem = Number(localStorage.getItem(LS_MEMORY) || "0");
      if (!isNaN(mem)) setMemory(mem);
      const h = JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
      if (Array.isArray(h)) setHistory(h);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem(LS_MODE, mode);
  }, [mode]);
  useEffect(() => {
    localStorage.setItem(LS_ANGLE, angle);
  }, [angle]);
  useEffect(() => {
    localStorage.setItem(LS_MEMORY, String(memory));
  }, [memory]);
  useEffect(() => {
    localStorage.setItem(LS_HISTORY, JSON.stringify(history.slice(0, 100)));
  }, [history]);

  const livePreview = useMemo(() => {
    if (!expression || error) return "";
    try {
      const r = evaluate(expression, angle);
      const f = formatNumber(r);
      if (f === expression) return "";
      return f;
    } catch {
      return "";
    }
  }, [expression, error, angle]);

  const clearAll = useCallback(() => {
    setExpression("");
    setResult("0");
    setError(null);
    setJustEvaluated(false);
  }, []);

  const backspace = useCallback(() => {
    setError(null);
    if (justEvaluated) {
      setJustEvaluated(false);
      return;
    }
    setExpression((e) => {
      // Remove multi-char tokens at end (sqrt(, sin(, " mod ", pi, etc.)
      const multi = [
        "sqrt(",
        "asin(",
        "acos(",
        "atan(",
        "sin(",
        "cos(",
        "tan(",
        "log(",
        "exp(",
        "abs(",
        "ln(",
        " mod ",
        "pi",
      ];
      for (const tok of multi) if (e.endsWith(tok)) return e.slice(0, -tok.length);
      return e.slice(0, -1);
    });
  }, [justEvaluated]);

  const computeNow = useCallback(
    (expr: string) => {
      const r = evaluate(expr, angle);
      return { raw: r, formatted: formatNumber(r) };
    },
    [angle],
  );

  const doEvaluate = useCallback(() => {
    if (!expression.trim()) return;
    try {
      const { formatted } = computeNow(expression);
      setResult(formatted);
      setError(null);
      setJustEvaluated(true);
      setHistory((h) =>
        [
          { id: crypto.randomUUID(), expression, result: formatted },
          ...h.filter((it) => !(it.expression === expression && it.result === formatted)),
        ].slice(0, 100),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      setError(msg);
      setResult("Error");
    }
  }, [expression, computeNow]);

  const toggleSign = useCallback(() => {
    setError(null);
    setExpression((prev) => {
      let base = prev;
      if (justEvaluated && !error) {
        base = result.replace(/,/g, "");
        setJustEvaluated(false);
      }
      // Find last numeric token and toggle its sign
      const match = base.match(/(-?\d+\.?\d*(?:[eE][+-]?\d+)?)$/);
      if (!match) {
        if (!base) return "-";
        return base + "(-";
      }
      const num = match[1];
      const start = base.length - num.length;
      if (num.startsWith("-")) {
        return base.slice(0, start) + num.slice(1);
      }
      // If preceded by another digit/operator boundary, just prepend minus
      const prevCh = base[start - 1];
      if (start === 0 || "+-*/(^".includes(prevCh)) {
        return base.slice(0, start) + "-" + num;
      }
      // Otherwise insert *-1 multiplier — simpler: wrap as (-num)
      return base.slice(0, start) + "(-" + num + ")";
    });
  }, [justEvaluated, error, result]);

  const reciprocal = useCallback(() => {
    setError(null);
    setExpression((prev) => {
      let base = prev;
      if (justEvaluated && !error) {
        base = result.replace(/,/g, "");
        setJustEvaluated(false);
      }
      if (!base) return "1/";
      // wrap whole expression
      return `1/(${base})`;
    });
  }, [justEvaluated, error, result]);

  const append = useCallback(
    (val: string) => {
      setError(null);
      setExpression((prev) => {
        let base = prev;
        const isBinaryOp = val.length === 1 && "+-*/^".includes(val);
        const isModOp = val === " mod ";

        if (justEvaluated) {
          base =
            isBinaryOp || isModOp || val === "%" || val === "!" || val.startsWith("^")
              ? result.replace(/,/g, "")
              : "";
          setJustEvaluated(false);
        }

        if (isBinaryOp) {
          if (!base && val !== "-") return base;
          // Replace trailing binary op
          const last = base.slice(-1);
          if (base && "+-*/^".includes(last)) return base.slice(0, -1) + val;
          if (base.endsWith(" mod ")) return base.slice(0, -5) + val;
          return base + val;
        }

        if (val === ".") {
          const seg = base.split(/[+\-*/()^]| mod /).pop() ?? "";
          if (seg.includes(".")) return base;
          if (!seg) return base + "0.";
          return base + ".";
        }

        return base + val;
      });
    },
    [justEvaluated, result],
  );

  const handleMemory = useCallback(
    (op: string) => {
      switch (op) {
        case "MC":
          setMemory(0);
          toast.success("Memory cleared");
          break;
        case "MR":
          append(String(memory));
          break;
        case "MS": {
          try {
            const r = expression ? computeNow(expression).raw : Number(result.replace(/,/g, ""));
            if (isFinite(r)) {
              setMemory(r);
              toast.success(`Stored ${formatNumber(r)}`);
            }
          } catch {
            toast.error("Cannot store invalid value");
          }
          break;
        }
        case "M+":
        case "M-": {
          try {
            const r = expression ? computeNow(expression).raw : Number(result.replace(/,/g, ""));
            if (isFinite(r)) {
              const next = op === "M+" ? memory + r : memory - r;
              setMemory(next);
              toast.success(`Memory ${op === "M+" ? "+" : "−"} ${formatNumber(r)}`);
            }
          } catch {
            toast.error("Invalid expression");
          }
          break;
        }
      }
    },
    [append, memory, expression, result, computeNow],
  );

  const handleKey = useCallback(
    (k: KeyDef) => {
      setPressed(k.value);
      window.setTimeout(() => setPressed(null), 120);
      switch (k.value) {
        case "AC":
          return clearAll();
        case "=":
          return doEvaluate();
        case "NEG":
          return toggleSign();
        case "RECIP":
          return reciprocal();
      }
      if (k.kind === "memory") return handleMemory(k.value);
      if (k.value === "%" || k.value === "!") {
        append(k.value);
        return;
      }
      append(k.value);
    },
    [clearAll, doEvaluate, toggleSign, reciprocal, handleMemory, append],
  );

  // Copy result
  const copyResult = useCallback(async () => {
    const value = error ? "" : justEvaluated ? result : livePreview || result;
    if (!value || value === "Error") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard", { description: value });
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Copy failed");
    }
  }, [error, justEvaluated, result, livePreview]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && (k === "c" || k === "C")) {
        // Don't hijack when user is selecting text in inputs (no inputs here, safe)
        e.preventDefault();
        copyResult();
        return;
      }
      if (ctrl && (k === "m" || k === "M")) {
        e.preventDefault();
        setMode((m) => (m === "standard" ? "scientific" : "standard"));
        return;
      }
      if (ctrl && (k === "h" || k === "H")) {
        e.preventDefault();
        setShowHistory((v) => !v);
        return;
      }

      if (k === "Enter" || k === "=") {
        e.preventDefault();
        doEvaluate();
        flash("=");
        return;
      }
      if (k === "Backspace") {
        e.preventDefault();
        backspace();
        return;
      }
      if (k === "Escape") {
        e.preventDefault();
        clearAll();
        return;
      }
      if (k === "Delete") {
        e.preventDefault();
        clearAll();
        return;
      }
      if (k === "%") {
        e.preventDefault();
        append("%");
        flash("%");
        return;
      }
      if (k === "!") {
        e.preventDefault();
        append("!");
        flash("!");
        return;
      }
      if (k === "^") {
        e.preventDefault();
        append("^");
        flash("^");
        return;
      }
      if (k === "(" || k === ")") {
        e.preventDefault();
        append(k);
        flash(k);
        return;
      }
      if (/^[0-9.]$/.test(k)) {
        append(k);
        flash(k);
        return;
      }
      if (k === "+" || k === "-" || k === "*" || k === "/") {
        append(k);
        flash(k);
        return;
      }

      function flash(key: string) {
        setPressed(key);
        window.setTimeout(() => setPressed(null), 120);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [append, backspace, clearAll, copyResult, doEvaluate]);

  const reuseHistory = (item: HistoryItem) => {
    setExpression(item.result.replace(/,/g, ""));
    setResult(item.result);
    setJustEvaluated(true);
    setError(null);
  };

  const removeHistory = (id: string) => setHistory((h) => h.filter((x) => x.id !== id));

  const keys = mode === "standard" ? STANDARD_KEYS : SCI_KEYS;
  const cols = mode === "standard" ? "grid-cols-4" : "grid-cols-6";

  const displayValue = error ? error : justEvaluated ? result : livePreview || result;

  return (
    <div className="min-h-screen w-full px-3 py-6 sm:px-4 sm:py-10 flex items-start justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        {/* Calculator */}
        <div className="glass-panel rounded-3xl p-5 sm:p-7 animate-fade-up">
          {/* Header */}
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-equals-foreground shadow-lg"
                style={{ background: "var(--gradient-equals)" }}
              >
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Calcify</h1>
                <p className="text-xs text-muted-foreground truncate">
                  Where Precision Meets Elegance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="lg:hidden grid h-10 w-10 place-items-center rounded-xl key-base hover:key-base-hover active:key-press"
                aria-label="Toggle history"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                className="grid h-10 w-10 place-items-center rounded-xl key-base hover:key-base-hover active:key-press"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </header>

          {/* Mode toggles */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <ModeSegmented
              value={mode}
              onChange={(v) => setMode(v)}
              options={[
                {
                  value: "standard",
                  label: "Standard",
                  icon: <CalcIcon className="h-3.5 w-3.5" />,
                },
                {
                  value: "scientific",
                  label: "Scientific",
                  icon: <Sparkles className="h-3.5 w-3.5" />,
                },
              ]}
            />
            {mode === "scientific" && (
              <ModeSegmented
                value={angle}
                onChange={(v) => setAngle(v as AngleMode)}
                options={[
                  { value: "deg", label: "DEG" },
                  { value: "rad", label: "RAD" },
                ]}
              />
            )}
            {memory !== 0 && (
              <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-muted-foreground bg-[var(--glass-bg)] border border-border/60">
                <span className="font-semibold text-foreground">M</span>
                <span className="truncate max-w-[120px]">{formatNumber(memory)}</span>
              </span>
            )}
          </div>

          {/* Display */}
          <div className="rounded-2xl bg-[var(--glass-bg)] border border-border/60 p-5 sm:p-6 mb-5 min-h-[150px] flex flex-col justify-end overflow-hidden relative">
            <div className="text-right text-muted-foreground text-base sm:text-lg font-mono break-all min-h-[1.75rem]">
              {prettyExpr(expression) || "\u00A0"}
            </div>
            <div className="flex items-end justify-end gap-3">
              <button
                onClick={copyResult}
                className={cn(
                  "shrink-0 grid place-items-center h-9 w-9 rounded-lg key-base hover:key-base-hover active:key-press transition-all",
                  copied && "text-equals-foreground",
                )}
                style={copied ? { background: "var(--gradient-equals)" } : undefined}
                aria-label="Copy result"
                title="Copy (Ctrl/Cmd + C)"
              >
                {copied ? <Check className="h-4 w-4 animate-pop" /> : <Copy className="h-4 w-4" />}
              </button>
              <div
                key={displayValue + (error ? "e" : "")}
                className={cn(
                  "flex-1 text-right font-mono font-semibold tracking-tight break-all animate-pop",
                  error
                    ? "text-destructive text-2xl sm:text-3xl"
                    : "text-foreground text-4xl sm:text-5xl",
                )}
              >
                {displayValue}
              </div>
            </div>
          </div>

          {/* Secondary controls */}
          <div className="flex items-center justify-between mb-4 text-xs text-muted-foreground gap-2">
            <span className="hidden sm:inline truncate">
              Enter to compute · Esc to clear · Ctrl+M mode · Ctrl+C copy
            </span>
            <button
              onClick={backspace}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 key-base hover:key-base-hover active:key-press text-foreground shrink-0"
              aria-label="Backspace"
            >
              <Delete className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>

          {/* Keypad */}
          <div key={mode} className={cn("grid gap-2 sm:gap-2.5 animate-fade-up", cols)}>
            {keys.map((k, idx) => (
              <button
                key={`${mode}-${idx}`}
                onClick={() => handleKey(k)}
                aria-label={k.ariaLabel ?? (typeof k.label === "string" ? k.label : k.value)}
                className={cn(
                  "key-base hover:key-base-hover active:key-press select-none rounded-2xl font-medium",
                  mode === "standard"
                    ? "h-14 sm:h-16 text-lg sm:text-xl"
                    : "h-11 sm:h-13 text-sm sm:text-base",
                  k.span === 2 && "col-span-2",
                  k.kind === "operator" && "text-operator-foreground border-transparent",
                  k.kind === "equals" && "text-equals-foreground border-transparent",
                  k.kind === "function" && "text-muted-foreground",
                  k.kind === "sci" && "text-foreground/90",
                  k.kind === "memory" &&
                    "text-primary text-xs sm:text-sm font-semibold tracking-wide",
                  pressed === k.value && "key-press",
                )}
                style={
                  k.kind === "operator"
                    ? { background: "var(--gradient-operator)" }
                    : k.kind === "equals"
                      ? { background: "var(--gradient-equals)" }
                      : undefined
                }
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {/* History */}
        <aside
          className={cn(
            "glass-panel rounded-3xl p-5 animate-fade-up lg:block",
            showHistory ? "block" : "hidden",
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <History className="h-4 w-4 shrink-0 text-muted-foreground" />
              <h2 className="font-semibold tracking-tight truncate">History</h2>
            </div>
            {history.length > 0 && (
              <button
                onClick={() => {
                  setHistory([]);
                  toast.success("History cleared");
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
              <RotateCcw className="h-6 w-6 mb-3 opacity-60" />
              <p className="text-sm">No calculations yet</p>
              <p className="text-xs mt-1 opacity-75">Your recent results will appear here</p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-[60vh] lg:max-h-[560px] overflow-y-auto pr-1">
              {history.map((item) => (
                <li key={item.id} className="group relative">
                  <button
                    onClick={() => reuseHistory(item)}
                    className="w-full text-left rounded-xl p-3 pr-9 key-base hover:key-base-hover active:key-press"
                  >
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {prettyExpr(item.expression)}
                    </div>
                    <div className="text-lg font-mono font-semibold text-foreground truncate">
                      = {item.result}
                    </div>
                  </button>
                  <button
                    onClick={() => removeHistory(item.id)}
                    aria-label="Delete entry"
                    className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

function ModeSegmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-[var(--glass-bg)] border border-border/60">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            value === o.value
              ? "text-equals-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground",
          )}
          style={value === o.value ? { background: "var(--gradient-equals)" } : undefined}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
