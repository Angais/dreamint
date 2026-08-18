import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type BudgetWidgetProps = {
  budgetCents: number | null;
  spentCents: number;
  budgetRemainingCents: number | null;
  /** Real cost of the most recent batch, from OpenRouter usage (incl. BYOK upstream cost). */
  lastGenerationCostCents: number | null;
  isBudgetLocked: boolean;
  onBudgetSave: (budgetCents: number) => void;
  onBudgetClear: () => void;
  onResetSpending: () => void;
};

const BUDGET_PRESETS_CENTS = [500, 1000, 2500];

function formatCents(amount: number): string {
  return `$${(amount / 100).toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
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
  lastGenerationCostCents,
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
  const lastCostLabel = useMemo(
    () => (lastGenerationCostCents !== null ? formatCents(lastGenerationCostCents) : null),
    [lastGenerationCostCents],
  );
  const budgetUsedPercent = useMemo(() => {
    if (budgetCents === null || budgetCents <= 0) {
      return null;
    }

    return Math.min(100, Math.max(0, (spentCents / budgetCents) * 100));
  }, [budgetCents, spentCents]);
  const isNearBudgetLimit =
    !isBudgetLocked &&
    budgetRemainingCents !== null &&
    lastGenerationCostCents !== null &&
    lastGenerationCostCents > 0 &&
    budgetRemainingCents < lastGenerationCostCents * 2;

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

  const handlePresetSave = (cents: number) => {
    setInputValue((cents / 100).toFixed(2));
    setFormError(null);
    onBudgetSave(cents);
  };

  const buttonClass = isBudgetLocked
    ? "border-red-500/50 text-red-200 bg-red-950/50 hover:bg-red-900/50 hover:border-red-500"
    : isNearBudgetLimit
      ? "border-amber-400/40 text-amber-100 bg-amber-950/40 hover:bg-amber-900/40 hover:border-amber-400/70"
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
          ) : isNearBudgetLimit ? (
            <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_2px_rgba(251,191,36,0.35)]" aria-hidden="true" />
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
                ) : isNearBudgetLimit ? (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
                    ALMOST SPENT
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

              {budgetUsedPercent !== null ? (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
                    <span>{formatPercent(budgetUsedPercent)} used</span>
                    {remainingLabel ? <span>{remainingLabel} left</span> : null}
                  </div>
                  <div
                    className="relative h-2 overflow-hidden rounded-full bg-black/40"
                    role="meter"
                    aria-label="Budget used"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(budgetUsedPercent)}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${
                        isBudgetLocked ? "bg-red-400" : "bg-white"
                      }`}
                      style={{ width: `${budgetUsedPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex items-baseline justify-between px-2 text-[var(--text-secondary)]">
                <span>Spent so far</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {spentLabel}
                </span>
              </div>

              {lastCostLabel ? (
                <div className="flex items-baseline justify-between px-2 text-[var(--text-secondary)]">
                  <span>Last batch</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {lastCostLabel}
                  </span>
                </div>
              ) : null}

              <p className="text-[var(--text-muted)] text-xs leading-relaxed px-1">
                Spending is tracked from the real cost OpenRouter reports for each generation,
                including upstream BYOK costs.
              </p>
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
              <div className="grid grid-cols-3 gap-2 pt-2">
                {BUDGET_PRESETS_CENTS.map((presetCents) => (
                  <button
                    key={presetCents}
                    type="button"
                    onClick={() => handlePresetSave(Math.max(0, spentCents) + presetCents)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-2 text-left transition-colors hover:border-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-white"
                    aria-label={`Add ${formatCents(presetCents)} of headroom`}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      +{formatCents(presetCents)}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-[var(--text-primary)]">
                      {formatCents(Math.max(0, spentCents) + presetCents)}
                    </span>
                  </button>
                ))}
              </div>
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
