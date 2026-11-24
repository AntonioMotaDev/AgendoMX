"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { copy } from "@/lib/copy";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validators/auth";

const c = copy.auth;

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setError(null);
    const { error: authError } = await authClient.requestPasswordReset({
      email: values.email.trim().toLowerCase(),
      redirectTo: "/restablecer",
    });
    if (authError?.status === 429) return setError(c.common.rateLimited);
    // Same answer whether or not the account exists.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success">{c.forgot.sentBody}</Alert>
        <Link href="/login" className="text-center text-sm font-medium text-brand-ink underline underline-offset-2">
          {c.forgot.back}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field
        label={c.common.email}
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? c.common.loading : c.forgot.submit}
      </Button>
      <Link href="/login" className="text-center text-sm font-medium text-brand-ink underline underline-offset-2">
        {c.forgot.back}
      </Link>
    </form>
  );
}
