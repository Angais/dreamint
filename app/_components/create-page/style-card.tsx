import Image from "next/image";
import { memo, useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import type { Style, StyleImage } from "./types";
import { createId } from "./utils";

type StyleCardProps = {
  style: Style;
  isSelected: boolean;
  isAnalyzing: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onAddImages: (images: StyleImage[]) => void;
  onRemoveImage: (imageId: string) => void;
  onAnalyzeStyle: () => void;
};

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadImageDimensions(src: string): Promise<{ width: number; height: number } | null> {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export const StyleCard = memo(function StyleCard({
  style,
  isSelected,
  isAnalyzing,
  onSelect,
  onDeselect,
  onUpdateName,
  onDelete,
  onAddImages,
  onRemoveImage,
  onAnalyzeStyle,
}: StyleCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(style.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleNameDoubleClick = useCallback(() => {
    setEditedName(style.name);
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }, [style.name]);

  const handleNameSave = useCallback(() => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== style.name) {
      onUpdateName(trimmed);
    } else {
      setEditedName(style.name);
    }
    setIsEditingName(false);
  }, [editedName, style.name, onUpdateName]);

  const handleNameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        handleNameSave();
      } else if (event.key === "Escape") {
        setEditedName(style.name);
        setIsEditingName(false);
      }
    },
    [handleNameSave, style.name]
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      const newImages: StyleImage[] = await Promise.all(
        imageFiles.map(async (file) => {
          const dataUrl = await readFileAsDataUrl(file);
          const dimensions = await loadImageDimensions(dataUrl);
          return {
            id: createId("style-img"),
            url: dataUrl,
            width: dimensions?.width ?? null,
            height: dimensions?.height ?? null,
          };
        })
      );

      onAddImages(newImages);
    },
    [onAddImages]
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;
      void processFiles(Array.from(fileList));
      event.target.value = "";
    },
    [processFiles]
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      void processFiles(files);
    },
    [processFiles]
  );

  const hasImages = style.images.length > 0;
  const hasDescription = style.description.length > 0;
  const canAnalyze = hasImages && !isAnalyzing;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border transition-all duration-200 ${
        isSelected
          ? "border-[var(--text-primary)] ring-1 ring-[var(--text-primary)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:border-[var(--border-highlight)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Selection Toggle */}
          <button
            type="button"
            onClick={isSelected ? onDeselect : onSelect}
            className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all duration-200 ${
              isSelected
                ? "border-[var(--text-primary)] bg-[var(--text-primary)]"
                : "border-[var(--border-highlight)] hover:border-[var(--text-primary)]"
            }`}
            aria-label={isSelected ? "Deselect style" : "Select style"}
          >
            {isSelected && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-full h-full text-[var(--bg-app)] p-0.5"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          {/* Name */}
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none border-b border-[var(--text-primary)]"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={handleNameDoubleClick}
              className="flex-1 min-w-0 text-left text-sm font-semibold text-[var(--text-primary)] truncate hover:opacity-70 transition-opacity"
              title="Click to edit name"
            >
              {style.name}
            </button>
          )}
        </div>

        {/* Delete Button */}
        <button
          type="button"
          onClick={onDelete}
          className="flex-shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950/30 transition-colors"
          aria-label="Delete style"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Image Upload Area */}
      <div
        className={`relative p-3 ${isDragOver ? "bg-[var(--bg-subtle)]" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {hasImages ? (
          <div className="grid grid-cols-4 gap-1.5">
            {style.images.slice(0, 8).map((img) => (
              <div
                key={img.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-subtle)] group"
              >
                <Image
                  src={img.url}
                  alt="Style reference"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="80px"
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/80"
                  aria-label="Remove image"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3 h-3"
                  >
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            ))}
            {style.images.length < 8 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Add more images"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`w-full py-8 rounded-xl border-2 border-dashed transition-colors ${
              isDragOver
                ? "border-[var(--text-primary)] bg-[var(--bg-subtle)]"
                : "border-[var(--border-subtle)] hover:border-[var(--text-primary)]"
            }`}
          >
            <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
              <span className="text-xs font-medium">Drop images or click to upload</span>
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Description Section */}
      {hasDescription && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            className="w-full text-left"
          >
            <div className="flex items-start gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--text-primary)]"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                />
              </svg>
              <p
                className={`text-xs text-[var(--text-secondary)] leading-relaxed ${
                  isDescriptionExpanded ? "" : "line-clamp-2"
                }`}
              >
                {style.description}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 pt-1">
        <button
          type="button"
          onClick={onAnalyzeStyle}
          disabled={!canAnalyze}
          className={`w-full py-2 px-4 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all duration-200 ${
            canAnalyze
              ? "bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90"
              : "bg-[var(--bg-subtle)] text-[var(--text-muted)] cursor-not-allowed"
          }`}
        >
          {isAnalyzing ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Analyzing...
            </span>
          ) : hasDescription ? (
            "Re-analyze Style"
          ) : (
            "Analyze Style"
          )}
        </button>
      </div>
    </div>
  );
});
