import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Recuperar contraseña — AgendoMX" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title={copy.auth.forgot.title} subtitle={copy.auth.forgot.subtitle}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
