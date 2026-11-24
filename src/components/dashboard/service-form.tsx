"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SwitchRow } from "@/components/ui/switch-row";
import { TextareaField } from "@/components/ui/textarea-field";
import { copy } from "@/lib/copy";
import { DURATION_OPTIONS_MIN } from "@/lib/validators/onboarding";
import { BUFFER_OPTIONS_MIN, serviceFormSchema, type ServiceFormData, type ServiceFormInput } from "@/lib/validators/services";
import { createServiceAction, deleteServiceAction, updateServiceAction } from "@/server/actions/services";

const t = copy.panel.services;
const common = copy.panel.common;

export const NEW_SERVICE_DEFAULTS: ServiceFormInput = {
  name: "",
  description: "",
  price: "",
  priceIsFrom: false,
  durationMin: 30,
  bufferAfterMin: 0,
  isBookableOnline: true,
  isActive: true,
};

export function ServiceForm({ serviceId, initial }: { serviceId?: string; initial: ServiceFormInput }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormInput, unknown, ServiceFormData>({ resolver: zodResolver(serviceFormSchema), defaultValues: initial });

  const duration = useWatch({ control, name: "durationMin" });
  const priceIsFrom = useWatch({ control, name: "priceIsFrom" });
  const isActive = useWatch({ control, name: "isActive" });
  const bookableOnline = useWatch({ control, name: "isBookableOnline" });

  const bufferOptions = [...new Set<number>([...BUFFER_OPTIONS_MIN, initial.bufferAfterMin])].sort((a, b) => a - b);
  const quickDurations = [...new Set<number>([...DURATION_OPTIONS_MIN, initial.durationMin])].sort((a, b) => a - b);

  async function onSubmit() {
    setFormError(null);
    // The server validates what the owner typed, not the client's parsed copy.
    const raw = getValues();
    const result = serviceId ? await updateServiceAction(serviceId, raw) : await createServiceAction(raw);
    if (!result.ok) {
      const field = result.error.field as keyof ServiceFormInput | undefined;
      if (field && field in initial) setError(field, { message: result.error.message });
      else setFormError(result.error.message);
      return;
    }
    router.push("/app/servicios");
    router.refresh();
  }

  async function onDelete() {
    if (!serviceId) return;
    setDeleting(true);
    setFormError(null);
    const result = await deleteServiceAction(serviceId);
    setDeleting(false);
    if (!result.ok) {
      setConfirmingDelete(false);
      return setFormError(result.error.message);
    }
    router.push("/app/servicios");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <Field label={t.name} placeholder={t.namePlaceholder} error={errors.name?.message} {...register("name")} />

      <TextareaField
        label={t.description}
        placeholder={t.descriptionPlaceholder}
        hint={t.descriptionHint}
        maxLength={280}
        error={errors.description?.message}
        {...register("description")}
      />

      <Field label={t.price} hint={t.priceHint} inputMode="decimal" autoComplete="off" error={errors.price?.message} {...register("price")} />
      <SwitchRow label={t.priceIsFrom} hint={t.priceIsFromHint} checked={priceIsFrom} onCheckedChange={(on) => setValue("priceIsFrom", on, { shouldValidate: true })} />

      <div className="flex flex-col gap-2">
        <span id="duration-label" className="text-sm font-medium text-ink">
          {t.duration}
        </span>
        <div role="radiogroup" aria-labelledby="duration-label" className="flex flex-wrap gap-2">
          {quickDurations.map((minutes) => (
            <Chip key={minutes} selected={duration === minutes} onSelect={() => setValue("durationMin", minutes, { shouldValidate: true })}>
              {copy.onboarding.service.durationOption(minutes)}
            </Chip>
          ))}
        </div>
        <Field
          label={t.durationMinutes}
          type="number"
          inputMode="numeric"
          min={5}
          max={720}
          step={5}
          error={errors.durationMin?.message}
          {...register("durationMin", { valueAsNumber: true })}
        />
      </div>

      <SelectField label={t.buffer} hint={t.bufferHint} error={errors.bufferAfterMin?.message} {...register("bufferAfterMin", { valueAsNumber: true })}>
        {bufferOptions.map((minutes) => (
          <option key={minutes} value={minutes}>
            {t.bufferOption(minutes)}
          </option>
        ))}
      </SelectField>

      <SwitchRow label={t.active} hint={t.activeHint} checked={isActive} onCheckedChange={(on) => setValue("isActive", on)} />
      <SwitchRow label={t.bookableOnline} hint={t.bookableOnlineHint} checked={bookableOnline} onCheckedChange={(on) => setValue("isBookableOnline", on)} />

      <Button type="submit" disabled={isSubmitting || deleting}>
        {isSubmitting ? common.saving : serviceId ? common.save : t.create}
      </Button>

      {serviceId ? (
        confirmingDelete ? (
          <div role="alertdialog" aria-labelledby="delete-title" className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger/5 p-4">
            <p id="delete-title" className="text-base font-semibold text-ink">
              {t.deleteTitle}
            </p>
            <p className="text-sm text-ink-muted">{t.deleteBody}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                {common.cancel}
              </Button>
              <Button className="bg-danger hover:bg-danger/90" onClick={onDelete} disabled={deleting}>
                {deleting ? common.saving : t.deleteConfirm}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="text-danger" onClick={() => setConfirmingDelete(true)}>
            {common.delete}
          </Button>
        )
      ) : null}
    </form>
  );
}
