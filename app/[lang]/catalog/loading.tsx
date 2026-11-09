export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl animate-pulse px-5 py-8">
      <div className="mb-6 h-7 w-40 rounded bg-[#221a35]" />
      <div className="mb-6 h-10 w-full rounded bg-[#221a35]" />
      <div className="mb-7 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 w-20 rounded-full bg-[#221a35]" />)}
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="h-[170px] rounded-xl bg-[#221a35]" />
            <div className="mt-2 h-4 w-3/4 rounded bg-[#221a35]" />
            <div className="mt-1 h-3 w-1/2 rounded bg-[#221a35]" />
          </div>
        ))}
      </div>
    </main>
  );
}
