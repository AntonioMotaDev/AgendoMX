import { copy } from "@/lib/copy";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{copy.home.headline}</h1>
      <p className="max-w-md text-lg text-zinc-600">{copy.home.subheadline}</p>
      <p className="text-sm text-zinc-500">{copy.home.comingSoon}</p>
      <p className="mt-8 text-xs text-zinc-400">{copy.home.byline}</p>
    </main>
  );
}
