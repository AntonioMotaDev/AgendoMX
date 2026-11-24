import { LogoutButton } from "@/components/auth/logout-button";
import { Logo } from "@/components/ui/logo";
import { requireOwner } from "@/lib/session";

export default async function DashboardLayout({ children }: LayoutProps<"/app">) {
  await requireOwner();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <Logo className="text-xl" />
        <LogoutButton />
      </header>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
