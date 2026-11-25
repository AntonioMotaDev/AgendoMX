import Link from "next/link";
import { Logo } from "@/components/ui/logo";

/** Plain public pages (legal texts, later the landing): a header with the logo and a readable column. */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface px-4 py-3">
        <Link href="/" aria-label="AgendoMX">
          <Logo className="text-xl" />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
