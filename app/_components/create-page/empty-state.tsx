export function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-[#1a1b24] bg-[#101117] px-10 py-14 text-center text-sm text-[#8b8e9d]">
      <p className="text-base font-medium text-white">No generations yet</p>
      <p className="mt-2 text-sm text-[#8b8e9d]">
        Enter a prompt above and choose your aspect, quality, and seed to create your first batch.
      </p>
    </div>
  );
}
