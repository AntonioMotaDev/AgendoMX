import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui/alert";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Confirma tu correo — AgendoMX", robots: { index: false } };

/**
 * Landing for both "check your inbox" (after sign-up) and the verification
 * link callback. A valid link signs the user in and the (auth) layout sends
 * them to /app; an invalid one arrives here with ?error=.
 */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verificar-correo">) {
  const { error } = await searchParams;
  const c = copy.auth;
  return error ? (
    <AuthCard title={c.verifyResult.invalidTitle}>
      <Alert tone="error">{c.verifyResult.invalidBody}</Alert>
      <Link href="/login" className="text-center text-sm font-medium text-brand-ink underline underline-offset-2">
        {c.verifyResult.back}
      </Link>
    </AuthCard>
  ) : (
    <AuthCard title={c.verifyPending.title}>
      <p className="text-base text-ink">{c.verifyPending.body}</p>
      <Link href="/login" className="text-center text-sm font-medium text-brand-ink underline underline-offset-2">
        {c.verifyPending.back}
      </Link>
    </AuthCard>
  );
}
