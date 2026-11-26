import { requireOwner } from "@/lib/session";

/** Auth gate for everything under /app. Each area (onboarding, panel) brings its own frame. */
export default async function DashboardLayout({ children }: LayoutProps<"/app">) {
  await requireOwner();
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
