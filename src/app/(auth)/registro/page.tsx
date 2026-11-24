import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Crear cuenta — AgendoMX" };

export default function RegisterPage() {
  return (
    <AuthCard title={copy.auth.register.title} subtitle={copy.auth.register.subtitle}>
      <RegisterForm />
    </AuthCard>
  );
}
