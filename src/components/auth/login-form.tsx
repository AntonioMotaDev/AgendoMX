"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { copy } from "@/lib/copy";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";

const c = copy.auth;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setError(null);
    setUnverifiedEmail(null);
    setResent(false);
    const email = values.email.trim().toLowerCase();
    const { error: authError } = await authClient.signIn.email({ email, password: values.password });
    if (!authError) {
      router.replace("/app");
      router.refresh();
      return;
    }
    if (authError.status === 403) {
      setUnverifiedEmail(email);
      setError(c.login.emailNotVerified);
    } else if (authError.status === 429) {
      setError(c.common.rateLimited);
    } else if (authError.status === 401) {
      setError(c.login.invalidCredentials);
    } else {
      setError(c.common.genericError);
    }
  }

  async function resend() {
    if (!unverifiedEmail) return;
    await authClient.sendVerificationEmail({ email: unverifiedEmail, callbackURL: "/verificar-correo" });
    setResent(true);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {unverifiedEmail ? (
        resent ? (
          <Alert tone="success">{c.login.resent}</Alert>
        ) : (
          <Button variant="secondary" onClick={resend}>
            {c.login.resend}
          </Button>
        )
      ) : null}
      <Field
        label={c.common.email}
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Field
        label={c.common.password}
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? c.common.loading : c.login.submit}
      </Button>
      <div className="flex flex-col gap-2 text-center text-sm">
        <Link href="/recuperar" className="font-medium text-brand-ink underline underline-offset-2">
          {c.login.forgot}
        </Link>
        <p className="text-ink-muted">
          {c.login.noAccount}{" "}
          <Link href="/registro" className="font-medium text-brand-ink underline underline-offset-2">
            {c.login.createAccount}
          </Link>
        </p>
      </div>
    </form>
  );
}
