"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { copy } from "@/lib/copy";
import { DURATION_OPTIONS_MIN, serviceStepSchema, type ServiceStepData, type ServiceStepInput } from "@/lib/validators/onboarding";
import { saveServiceStepAction } from "@/server/actions/onboarding";

const c = copy.onboarding;

export function ServiceStepForm({ initial }: { initial: { name: string; price: string; durationMin: number } }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ServiceStepInput, unknown, ServiceStepData>({
    resolver: zodResolver(serviceStepSchema),
    defaultValues: initial,
  });

  const duration = useWatch({ control, name: "durationMin" });
  // An existing service may have a duration outside the quick options; keep it selectable.
  const durations = [...new Set<number>([...DURATION_OPTIONS_MIN, initial.durationMin])].sort((a, b) => a - b);

  async function onSubmit() {
    setFormError(null);
    // The action validates the raw input again on the server; never trust the client's parse.
    const raw = getValues();
    const result = await saveServiceStepAction({ name: raw.name, price: raw.price, durationMin: raw.durationMin });
    if (!result.ok) return setFormError(result.error.message);
    router.push("/app/onboarding?paso=3");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <Field label={c.service.name} placeholder={c.service.namePlaceholder} error={errors.name?.message} {...register("name")} />

      <Field
        label={c.service.price}
        placeholder={c.service.pricePlaceholder}
        hint={c.service.priceHint}
        inputMode="decimal"
        autoComplete="off"
        error={errors.price?.message}
        {...register("price")}
      />

      <div className="flex flex-col gap-2">
        <span id="duration-label" className="text-sm font-medium text-ink">
          {c.service.duration}
        </span>
        <div role="radiogroup" aria-labelledby="duration-label" className="flex flex-wrap gap-2">
          {durations.map((minutes) => (
            <Chip key={minutes} selected={duration === minutes} onSelect={() => setValue("durationMin", minutes, { shouldValidate: true })}>
              {c.service.durationOption(minutes)}
            </Chip>
          ))}
        </div>
        {errors.durationMin?.message ? (
          <p role="alert" className="text-sm text-danger">
            {errors.durationMin.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? c.shell.saving : c.shell.next}
      </Button>
    </form>
  );
}
