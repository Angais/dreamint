import Image from "next/image";
import { useEffect, useRef } from "react";

import { XIcon } from "./icons";
import type { ImageThoughts } from "./types";
import { parseThoughtText, renderMarkdownBold } from "./utils";

type ThoughtsModalProps = {
  thoughts: ImageThoughts;
  onClose: () => void;
};

export function ThoughtsModal({ thoughts, onClose }: ThoughtsModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const hasText = (thoughts.text?.length ?? 0) > 0;
  const hasImages = (thoughts.images?.length ?? 0) > 0;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000]/90 backdrop-blur-sm p-4 outline-none animate-in fade-in duration-200"
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-pointer"
        aria-label="Close modal"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Chain of Thought
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full p-2 -mr-2 text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-subtle)] transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Thought Text */}
          {hasText && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Reasoning
              </h3>
              <div className="space-y-3">
                {thoughts.text?.map((text, index) => {
                  const { title, body } = parseThoughtText(text);
                  return (
                    <div
                      key={index}
                      className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
                    >
                      {title && (
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-2">
                          {title}
                        </h4>
                      )}
                      {body && (
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                          {renderMarkdownBold(body, "font-semibold text-[var(--text-primary)]")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thought Images (Interim compositions) */}
          {hasImages && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Interim Compositions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {thoughts.images!.map((src, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                  >
                    <Image
                      src={src}
                      alt={`Interim composition ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="300px"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/70 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                      Step {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasText && !hasImages && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-[var(--text-muted)]"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                No chain of thought data available for this image.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
          <p className="text-[11px] text-[var(--text-muted)] text-center">
            This shows how the model reasoned through the image generation process.
          </p>
        </div>
      </div>
    </div>
  );
}
