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
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators/auth";

const c = copy.auth;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordInput) {
    setError(null);
    const { error: authError } = await authClient.resetPassword({ newPassword: values.password, token });
    if (!authError) {
      router.replace("/login?restablecida=1");
      return;
    }
    if (authError.status === 429) return setError(c.common.rateLimited);
    if (authError.status === 400) return setInvalid(true);
    setError(c.common.genericError);
  }

  if (invalid) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="error">{c.reset.invalidToken}</Alert>
        <Link href="/recuperar" className="text-center text-sm font-medium text-brand-ink underline underline-offset-2">
          {c.reset.requestNew}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field
        label={c.common.password}
        type="password"
        autoComplete="new-password"
        hint={c.common.passwordHint}
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? c.common.loading : c.reset.submit}
      </Button>
    </form>
  );
}
