import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Entrar — AgendoMX" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { restablecida, eliminada } = await searchParams;
  return (
    <AuthCard title={copy.auth.login.title} subtitle={copy.auth.login.subtitle}>
      {eliminada ? <Alert tone="success">{copy.panel.profile.account.done}</Alert> : null}
      {restablecida ? <Alert tone="success">{copy.auth.reset.done}</Alert> : null}
      <LoginForm />
    </AuthCard>
  );
}
