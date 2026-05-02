"use client";

import { useEffect, useRef } from "react";

import { XIcon } from "./icons";

const CHANGELOG_ENTRIES = [
  {
    date: "May 2, 2026",
    changes: ["Added a changelog."],
  },
];

type ChangelogModalProps = {
  onClose: () => void;
};

export function ChangelogModal({ onClose }: ChangelogModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-8 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[var(--text-muted)]">
              Dreamint
            </p>
            <h2 id="changelog-title" className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Changelog
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label="Close changelog"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            {CHANGELOG_ENTRIES.map((entry) => (
              <article
                key={entry.date}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <time className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  {entry.date}
                </time>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {entry.changes.map((change) => (
                    <li key={change} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
