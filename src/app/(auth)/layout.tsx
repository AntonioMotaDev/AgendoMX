import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// Signed-in owners have nothing to do on these screens.
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getSession()) redirect("/app");
  return children;
}
