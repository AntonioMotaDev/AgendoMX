import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { copy } from "@/lib/copy";
import { legalPublished } from "@/lib/legal";
import { LEGAL_VERSION } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Crear cuenta — AgendoMX" };

// Reads a runtime flag: never prerendered with the value the build happened to see.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <AuthCard title={copy.auth.register.title} subtitle={copy.auth.register.subtitle}>
      <RegisterForm termsVersion={legalPublished() ? LEGAL_VERSION : null} />
    </AuthCard>
  );
}
