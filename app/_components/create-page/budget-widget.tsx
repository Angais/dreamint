import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type BudgetWidgetProps = {
  budgetCents: number | null;
  spentCents: number;
  budgetRemainingCents: number | null;
  batchCostCents: number;
  imagesPerBatch: number;
  isBudgetLocked: boolean;
  onBudgetSave: (budgetCents: number) => void;
  onBudgetClear: () => void;
  onResetSpending: () => void;
};

function formatCents(amount: number): string {
  return `$${(amount / 100).toFixed(2)}`;
}

function formatBatchLabel(count: number): string {
  const safeCount = Math.max(0, count);
  return `${safeCount} ${safeCount === 1 ? "batch" : "batches"}`;
}

function normalizeInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole, ...fractionParts] = cleaned.split(".");
  if (fractionParts.length === 0) {
    return whole;
  }

  const decimals = fractionParts.join("").replace(/\./g, "");
  return `${whole}.${decimals}`;
}

export function BudgetWidget({
  budgetCents,
  spentCents,
  budgetRemainingCents,
  batchCostCents,
  imagesPerBatch,
  isBudgetLocked,
  onBudgetSave,
  onBudgetClear,
  onResetSpending,
}: BudgetWidgetProps) {
  const [inputValue, setInputValue] = useState(() =>
    budgetCents !== null ? (budgetCents / 100).toFixed(2) : "",
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setInputValue(budgetCents !== null ? (budgetCents / 100).toFixed(2) : "");
  }, [budgetCents]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !toggleButtonRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setFormError(null);
    }
  }, [isOpen]);

  const spentLabel = useMemo(() => formatCents(Math.max(0, spentCents)), [spentCents]);
  const remainingLabel = useMemo(
    () =>
      budgetRemainingCents !== null
        ? formatCents(Math.max(0, budgetRemainingCents))
        : null,
    [budgetRemainingCents],
  );
  const budgetLabel = useMemo(
    () => (budgetCents !== null ? formatCents(Math.max(0, budgetCents)) : null),
    [budgetCents],
  );
  const batchCostLabel = useMemo(() => formatCents(batchCostCents), [batchCostCents]);

  const completedRuns = useMemo(
    () => Math.floor(Math.max(0, spentCents) / Math.max(1, batchCostCents)),
    [spentCents, batchCostCents],
  );
  const remainingRuns = useMemo(() => {
    if (budgetRemainingCents === null) {
      return null;
    }

    return Math.max(0, Math.floor(budgetRemainingCents / Math.max(1, batchCostCents)));
  }, [budgetRemainingCents, batchCostCents]);

  const collapsedSummary = useMemo(() => {
    if (budgetRemainingCents !== null) {
      return `${formatCents(Math.max(0, budgetRemainingCents))} left`;
    }

    if (budgetLabel) {
      return `${budgetLabel} budget`;
    }

    return "Set budget";
  }, [budgetRemainingCents, budgetLabel]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = normalizeInput(inputValue).trim();
    if (trimmed.length === 0) {
      setFormError("Enter a budget amount before saving.");
      return;
    }

    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFormError("Enter a valid dollar amount.");
      return;
    }

    const decimalPart = trimmed.includes(".") ? trimmed.split(".")[1] : "";
    if (decimalPart.length > 2) {
      setFormError("Use at most two decimal places.");
      return;
    }

    const cents = Math.round(parsed * 100);
    onBudgetSave(cents);
    setFormError(null);
  };

  const handleClear = () => {
    setFormError(null);
    setInputValue("");
    onBudgetClear();
  };

  // New, more visible button style
  const buttonClass = isBudgetLocked 
    ? "border-red-500/50 text-red-200 bg-red-950/50 hover:bg-red-900/50 hover:border-red-500" 
    : "border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-white shadow-md";

  return (
    <aside
      ref={containerRef}
      className="pointer-events-auto fixed bottom-4 right-4 z-50 text-xs sm:top-6 sm:right-6 sm:bottom-auto"
    >
      <div className="flex flex-col items-end">
        <button
          ref={toggleButtonRef}
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((previous) => !previous)}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold shadow-lg transition-all duration-200 ${buttonClass}`}
        >
          <span className="uppercase tracking-wider opacity-80">Budget</span>
          <span className="font-bold">{collapsedSummary}</span>
          {isBudgetLocked ? (
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_2px_rgba(239,68,68,0.4)]" aria-hidden="true" />
          ) : null}
        </button>
        {isOpen ? (
          <div
            ref={panelRef}
            role="dialog"
            className={`glass-panel mt-3 w-full max-w-xs rounded-2xl border border-[var(--border-subtle)] p-5 shadow-2xl transition-all duration-200 sm:max-w-sm animate-in fade-in slide-in-from-top-2 ${
              isBudgetLocked ? 'bg-red-950/90 border-red-900/50 shadow-red-900/20' : 'bg-[#0b0d14]'
            }`}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Budget tracker
                </span>
                {isBudgetLocked ? (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-400 border border-red-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
                    LIMIT REACHED
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close budget tracker"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-white hover:border-[var(--text-muted)]"
              >
                Close
              </button>
            </header>
            
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-baseline justify-between p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]">Total Budget</span>
                <span className="text-lg font-bold text-white tracking-tight">
                  {budgetLabel ?? "Not set"}
                </span>
              </div>
              
              {budgetLabel ? (
                <div className="flex items-baseline justify-between px-2 text-[var(--text-secondary)]">
                  <span>Remaining</span>
                  <span className={`text-sm font-medium ${budgetRemainingCents !== null && budgetRemainingCents < batchCostCents ? 'text-red-400 font-bold' : 'text-white'}`}>
                    {remainingLabel} {remainingRuns !== null ? `(${formatBatchLabel(remainingRuns)})` : null}
                  </span>
                </div>
              ) : (
                <p className="text-[var(--text-muted)] text-xs leading-relaxed px-1">
                  Each batch of {imagesPerBatch} images costs <span className="text-[var(--text-primary)] font-medium">{batchCostLabel}</span>.
                </p>
              )}
              
              <div className="flex items-baseline justify-between px-2 text-[var(--text-secondary)]">
                <span>Spent so far</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {spentLabel} ({formatBatchLabel(completedRuns)})
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-2 border-t border-[var(--border-subtle)] pt-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Set new budget
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    $
                  </span>
                  <input
                    value={inputValue}
                    onChange={(event) => {
                      setInputValue(normalizeInput(event.target.value));
                      if (formError) {
                        setFormError(null);
                      }
                    }}
                    placeholder="e.g. 10.00"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] py-2 pl-6 pr-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                </div>
                 <button
                  type="submit"
                  className="rounded-lg bg-white px-4 py-2 text-[11px] font-bold text-black transition-transform hover:scale-105 active:scale-95 shadow-sm"
                >
                  Save
                </button>
              </div>
              {formError ? (
                <p className="text-[11px] text-red-400 font-medium animate-pulse">{formError}</p>
              ) : null}
            </form>
            
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                onClick={onResetSpending}
                disabled={spentCents === 0}
                className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset spending
              </button>
              {budgetCents !== null ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-subtle)]"
                >
                  Clear budget
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
