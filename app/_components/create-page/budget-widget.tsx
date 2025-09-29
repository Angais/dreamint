import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type BudgetWidgetProps = {
  budgetCents: number | null;
  spentCents: number;
  budgetRemainingCents: number | null;
  batchCostCents: number;
  imageCostCents: number;
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
  imageCostCents,
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
  const imageCostLabel = useMemo(() => formatCents(imageCostCents), [imageCostCents]);

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

  const cardBorderClass = isBudgetLocked ? "border-[#ff5f7a]" : "border-[#1a1b24]";
  const cardBgClass = isBudgetLocked ? "bg-[#140b10]" : "bg-[#0c0d14]";

  return (
    <aside
      ref={containerRef}
      className="pointer-events-auto fixed bottom-4 right-4 z-50 text-xs text-white sm:top-6 sm:right-6 sm:bottom-auto"
    >
      <div className="flex flex-col items-end">
        <button
          ref={toggleButtonRef}
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((previous) => !previous)}
          className="flex items-center gap-2 rounded-full border border-[#2a2b36] bg-[#11121a] px-4 py-2 text-[11px] font-semibold text-[#d4d5df] shadow-[0_18px_40px_-30px_rgba(0,0,0,0.85)] transition-colors hover:border-[#3f404c] hover:text-white"
        >
          <span className="uppercase tracking-[0.3em] text-[#6a6c7b]">Budget</span>
          <span className="text-white">{collapsedSummary}</span>
          {isBudgetLocked ? (
            <span className="h-2 w-2 rounded-full bg-[#ff5f7a]" aria-hidden="true" />
          ) : null}
        </button>
        {isOpen ? (
          <div
            ref={panelRef}
            role="dialog"
            className={`mt-3 w-full max-w-xs rounded-3xl border ${cardBorderClass} ${cardBgClass} p-4 shadow-[0_22px_45px_-35px_rgba(0,0,0,0.8)] transition-colors sm:max-w-sm`}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.35em] text-[#6a6c7b]">
                  Budget tracker
                </span>
                {isBudgetLocked ? (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#ff5f7a]/10 px-2 py-0.5 text-[10px] font-semibold text-[#ff9fb0]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ff9fb0]" aria-hidden="true" />
                    Budget reached
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close budget tracker"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-[#2a2b36] bg-[#14151f] px-2 py-1 text-[10px] font-semibold text-[#9fa1b1] transition-colors hover:border-[#3f404c] hover:text-white"
              >
                Close
              </button>
            </header>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-[#898ba0]">Budget</span>
                <span className="text-base font-semibold text-[#f4f5f9]">
                  {budgetLabel ?? "Not set"}
                </span>
              </div>
              {budgetLabel ? (
                <div className="flex items-baseline justify-between text-[#898ba0]">
                  <span>Remaining</span>
                  <span className="text-sm font-medium text-[#f4f5f9]">
                    {remainingLabel} {remainingRuns !== null ? `(${formatBatchLabel(remainingRuns)})` : null}
                  </span>
                </div>
              ) : (
                <p className="text-[#6f7186]">
                  Each batch ({imagesPerBatch} images) costs {batchCostLabel} ({imageCostLabel} per image).
                </p>
              )}
              <div className="flex items-baseline justify-between text-[#898ba0]">
                <span>Spent</span>
                <span className="text-sm font-medium text-[#f4f5f9]">
                  {spentLabel} ({formatBatchLabel(completedRuns)})
                </span>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="mt-3 space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.3em] text-[#6a6c7b]">
                Set budget
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5d5f6d]">
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
                    placeholder="e.g. 5"
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-[#1f202b] bg-[#11121a] py-2 pl-6 pr-3 text-sm text-[#f4f5f9] placeholder:text-[#5d5f6d] focus:border-[#2a2b36] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-2xl bg-[#e9eaef] px-3 py-2 text-[11px] font-semibold text-[#090a12] transition-colors hover:bg-white"
                >
                  Save
                </button>
              </div>
              {formError ? (
                <p className="text-[11px] text-[#ff9fb0]">{formError}</p>
              ) : null}
            </form>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                onClick={onResetSpending}
                disabled={spentCents === 0}
                className="rounded-full border border-[#2a2b36] px-3 py-1 font-semibold text-[#a7a9ba] transition-colors hover:border-[#3f404c] hover:text-white disabled:cursor-not-allowed disabled:border-[#1f202b] disabled:text-[#4f5161]"
              >
                Reset spending
              </button>
              {budgetCents !== null ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-full border border-[#2a2b36] px-3 py-1 font-semibold text-[#a7a9ba] transition-colors hover:border-[#3f404c] hover:text-white"
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
