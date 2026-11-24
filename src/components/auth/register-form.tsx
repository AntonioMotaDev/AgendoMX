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
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";

const c = copy.auth;

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setError(null);
    const { error: authError } = await authClient.signUp.email({
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
      callbackURL: "/verificar-correo",
    });
    if (!authError) {
      // Same screen whether or not the email already existed: no account probing.
      router.replace("/verificar-correo");
      return;
    }
    setError(authError.status === 429 ? c.common.rateLimited : c.common.genericError);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field label={c.common.name} autoComplete="name" error={errors.name?.message} {...register("name")} />
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
        autoComplete="new-password"
        hint={c.common.passwordHint}
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? c.common.loading : c.register.submit}
      </Button>
      <p className="text-center text-xs text-ink-muted">{c.register.terms}</p>
      <p className="text-center text-sm text-ink-muted">
        {c.register.haveAccount}{" "}
        <Link href="/login" className="font-medium text-brand-ink underline underline-offset-2">
          {c.register.login}
        </Link>
      </p>
    </form>
  );
}
