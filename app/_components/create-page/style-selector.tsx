import { memo } from "react";
import type { Style } from "./types";

type StyleSelectorProps = {
  styles: Style[];
  selectedStyleId: string | null;
  onSelectStyle: (styleId: string | null) => void;
  disabled?: boolean;
};

export const StyleSelector = memo(function StyleSelector({
  styles,
  selectedStyleId,
  onSelectStyle,
  disabled = false,
}: StyleSelectorProps) {
  // Filter out styles that don't have images (not ready)
  const readyStyles = styles.filter((s) => s.images.length > 0);

  // If no styles are available, we can either hide the component or show it disabled.
  // Matching the behavior of other selectors, we'll keep it visible but maybe just with "No Style" if empty.
  // If the user wants it hidden when empty, we can return null. 
  // For now, let's render it so the layout remains stable, but if styles are empty it just shows "No Style".
  
  return (
    <div className="relative group/select shrink-0">
      <select
        value={selectedStyleId ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onSelectStyle(val === "" ? null : val);
        }}
        disabled={disabled}
        className="appearance-none cursor-pointer rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] pl-2 pr-6 md:pl-3 md:pr-8 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-white hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">No Style</option>
        {readyStyles.map((style) => (
          <option key={style.id} value={style.id}>
            {style.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 md:right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
        <svg
          width="8"
          height="5"
          viewBox="0 0 8 5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1L4 4L7 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
});

