import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Nueva contraseña — AgendoMX", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/restablecer">) {
  const { token, error } = await searchParams;
  const validToken = typeof token === "string" && token.length > 0 && !error ? token : null;
  return (
    <AuthCard title={copy.auth.reset.title} subtitle={validToken ? copy.auth.reset.subtitle : undefined}>
      {validToken ? (
        <ResetPasswordForm token={validToken} />
      ) : (
        <>
          <Alert tone="error">{copy.auth.reset.invalidToken}</Alert>
          <Link href="/recuperar" className="text-center text-sm font-medium text-brand-ink underline underline-offset-2">
            {copy.auth.reset.requestNew}
          </Link>
        </>
      )}
    </AuthCard>
  );
}
