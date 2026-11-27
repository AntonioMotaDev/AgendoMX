import Link from "next/link";
import { Illustration } from "@/components/illustrations/illustration";
import { Logo } from "@/components/ui/logo";

export default function PublicNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Logo />
      <Illustration kind="notFound" className="max-w-xs [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)]" />
      <h1 className="text-xl font-semibold text-ink">No encontramos este negocio</h1>
      <p className="text-base text-ink-muted">Revisa que el link esté completo. Si te lo compartieron, pídele al negocio que lo confirme.</p>
      <Link href="/" className="text-sm font-semibold text-brand-ink underline underline-offset-4">
        Ir a AgendoMX
      </Link>
    </main>
  );
}
