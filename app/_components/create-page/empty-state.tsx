import { LightningIcon } from "./icons";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-panel)] px-6 py-24 text-center transition-colors">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-subtle)] mb-6 shadow-inner ring-1 ring-[var(--border-subtle)]">
        <LightningIcon className="h-10 w-10 text-[var(--accent-primary)] opacity-90" />
      </div>
      <h3 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Start Dreaming</h3>
      <p className="mt-3 max-w-md text-sm text-[var(--text-secondary)] leading-relaxed">
        Enter a prompt above to generate your first batch of images. 
        <br />
        Try describing a scene, style, or mood.
      </p>
    </div>
  );
}
