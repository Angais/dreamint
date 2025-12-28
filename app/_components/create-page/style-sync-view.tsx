import { memo, useCallback, useState } from "react";

import { generateStyleDescription } from "../../lib/generate-style-description";
import { StyleCard } from "./style-card";
import type { Style, StyleImage } from "./types";
import { createId } from "./utils";

type StyleSyncViewProps = {
  styles: Style[];
  selectedStyleId: string | null;
  geminiApiKey: string;
  onCreateStyle: (style: Style) => void;
  onUpdateStyle: (styleId: string, updates: Partial<Style>) => void;
  onDeleteStyle: (styleId: string) => void;
  onSelectStyle: (styleId: string | null) => void;
};

export const StyleSyncView = memo(function StyleSyncView({
  styles,
  selectedStyleId,
  geminiApiKey,
  onCreateStyle,
  onUpdateStyle,
  onDeleteStyle,
  onSelectStyle,
}: StyleSyncViewProps) {
  const [analyzingStyleId, setAnalyzingStyleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateStyle = useCallback(() => {
    const now = new Date().toISOString();
    const newStyle: Style = {
      id: createId("style"),
      name: `Style ${styles.length + 1}`,
      images: [],
      description: "",
      createdAt: now,
      updatedAt: now,
    };
    onCreateStyle(newStyle);
  }, [styles.length, onCreateStyle]);

  const handleAnalyzeStyle = useCallback(
    async (styleId: string) => {
      const style = styles.find((s) => s.id === styleId);
      if (!style || style.images.length === 0) return;

      setAnalyzingStyleId(styleId);
      setError(null);

      try {
        const description = await generateStyleDescription({
          images: style.images.map((img) => ({ url: img.url })),
          geminiApiKey,
        });

        onUpdateStyle(styleId, {
          description,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to analyze style");
      } finally {
        setAnalyzingStyleId(null);
      }
    },
    [styles, geminiApiKey, onUpdateStyle]
  );

  const handleAddImages = useCallback(
    (styleId: string, newImages: StyleImage[]) => {
      const style = styles.find((s) => s.id === styleId);
      if (!style) return;

      const existingUrls = new Set(style.images.map((img) => img.url));
      const uniqueImages = newImages.filter((img) => !existingUrls.has(img.url));
      const maxImages = 8;
      const availableSlots = maxImages - style.images.length;
      const imagesToAdd = uniqueImages.slice(0, availableSlots);

      if (imagesToAdd.length === 0) return;

      onUpdateStyle(styleId, {
        images: [...style.images, ...imagesToAdd],
        updatedAt: new Date().toISOString(),
      });
    },
    [styles, onUpdateStyle]
  );

  const handleRemoveImage = useCallback(
    (styleId: string, imageId: string) => {
      const style = styles.find((s) => s.id === styleId);
      if (!style) return;

      onUpdateStyle(styleId, {
        images: style.images.filter((img) => img.id !== imageId),
        updatedAt: new Date().toISOString(),
      });
    },
    [styles, onUpdateStyle]
  );

  return (
    <main className="flex flex-1 flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Style Sync</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Create reusable styles from reference images
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateStyle}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-app)] text-xs font-semibold uppercase tracking-wide hover:opacity-90 transition-opacity"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          New Style
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-800/50 bg-red-950/30 text-red-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 flex-shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto p-1 rounded hover:bg-red-900/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}

      {/* Styles Grid */}
      {styles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {styles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              isSelected={selectedStyleId === style.id}
              isAnalyzing={analyzingStyleId === style.id}
              onSelect={() => onSelectStyle(style.id)}
              onDeselect={() => onSelectStyle(null)}
              onUpdateName={(name) =>
                onUpdateStyle(style.id, { name, updatedAt: new Date().toISOString() })
              }
              onDelete={() => onDeleteStyle(style.id)}
              onAddImages={(images) => handleAddImages(style.id, images)}
              onRemoveImage={(imageId) => handleRemoveImage(style.id, imageId)}
              onAnalyzeStyle={() => handleAnalyzeStyle(style.id)}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-10 h-10 text-[var(--text-muted)]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
              />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">
            No styles yet
          </h2>
          <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">
            Create a style by uploading reference images with a consistent artistic style. The AI
            will analyze them and generate a reusable style prompt.
          </p>
          <button
            type="button"
            onClick={handleCreateStyle}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--text-primary)] text-[var(--bg-app)] text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Create Your First Style
          </button>
        </div>
      )}

      {/* Selected Style Indicator */}
      {selectedStyleId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-app)] text-sm font-medium shadow-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              Using: <strong>{styles.find((s) => s.id === selectedStyleId)?.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => onSelectStyle(null)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Deselect style"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </main>
  );
});
