export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl animate-pulse px-5 py-10">
      <div className="mb-6 h-4 w-48 rounded bg-[#221a35]" />
      <div className="mb-8 h-8 w-2/3 rounded bg-[#221a35]" />
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-[#221a35]" style={{ width: `${70 + (i % 4) * 8}%` }} />
        ))}
      </div>
    </main>
  );
}
