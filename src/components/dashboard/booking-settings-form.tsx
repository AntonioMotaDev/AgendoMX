"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SelectField } from "@/components/ui/select";
import { TextareaField } from "@/components/ui/textarea-field";
import {
  CANCELLATION_OPTIONS_HOURS,
  CONFIRMATION_MODES,
  EXPIRY_OPTIONS_HOURS,
  LEAD_TIME_OPTIONS_MIN,
  WINDOW_OPTIONS_DAYS,
  withCurrent,
} from "@/lib/booking-options";
import { copy } from "@/lib/copy";
import { bookingSettingsSchema, type BookingSettingsData, type BookingSettingsInput } from "@/lib/validators/profile";
import { saveBookingSettingsAction } from "@/server/actions/profile";

const t = copy.panel.profile.booking;
const common = copy.panel.common;

export function BookingSettingsForm({ initial }: { initial: BookingSettingsInput }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<BookingSettingsInput, unknown, BookingSettingsData>({ resolver: zodResolver(bookingSettingsSchema), defaultValues: initial });
  const mode = useWatch({ control, name: "confirmationMode" });

  async function onSubmit() {
    setFormError(null);
    setSaved(false);
    const result = await saveBookingSettingsAction(getValues());
    if (!result.ok) return setFormError(result.error.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5" onChange={() => setSaved(false)}>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {saved ? <Alert tone="success">{common.saved}</Alert> : null}

      <div className="flex flex-col gap-2">
        <span id="mode-label" className="text-sm font-medium text-ink">
          {t.confirmationTitle}
        </span>
        <div role="radiogroup" aria-labelledby="mode-label" className="flex flex-wrap gap-2">
          {CONFIRMATION_MODES.map((value) => (
            <Chip key={value} selected={mode === value} onSelect={() => setValue("confirmationMode", value, { shouldDirty: true })}>
              {t.modes[value]}
            </Chip>
          ))}
        </div>
        <p className="text-sm text-ink-muted">{t.modeHint[mode === "manual" ? "manual" : "auto"]}</p>
      </div>

      {mode === "manual" ? (
        <SelectField label={t.expiry} hint={t.expiryHint} error={errors.pendingExpiryHours?.message} {...register("pendingExpiryHours", { valueAsNumber: true })}>
          {withCurrent(EXPIRY_OPTIONS_HOURS, initial.pendingExpiryHours).map((hours) => (
            <option key={hours} value={hours}>
              {t.expiryOption(hours)}
            </option>
          ))}
        </SelectField>
      ) : null}

      <SelectField label={t.leadTime} hint={t.leadTimeHint} error={errors.bookingLeadTimeMin?.message} {...register("bookingLeadTimeMin", { valueAsNumber: true })}>
        {withCurrent(LEAD_TIME_OPTIONS_MIN, initial.bookingLeadTimeMin).map((minutes) => (
          <option key={minutes} value={minutes}>
            {t.leadTimeOption(minutes)}
          </option>
        ))}
      </SelectField>

      <SelectField label={t.window} hint={t.windowHint} error={errors.bookingWindowDays?.message} {...register("bookingWindowDays", { valueAsNumber: true })}>
        {withCurrent(WINDOW_OPTIONS_DAYS, initial.bookingWindowDays).map((days) => (
          <option key={days} value={days}>
            {t.windowOption(days)}
          </option>
        ))}
      </SelectField>

      <SelectField label={t.cancellation} hint={t.cancellationHint} error={errors.cancellationMinHours?.message} {...register("cancellationMinHours", { valueAsNumber: true })}>
        {withCurrent(CANCELLATION_OPTIONS_HOURS, initial.cancellationMinHours).map((hours) => (
          <option key={hours} value={hours}>
            {t.cancellationOption(hours)}
          </option>
        ))}
      </SelectField>

      <TextareaField
        label={t.policy}
        placeholder={t.policyPlaceholder}
        hint={t.policyHint}
        maxLength={280}
        error={errors.cancellationPolicyText?.message}
        {...register("cancellationPolicyText")}
      />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? common.saving : common.save}
      </Button>
    </form>
  );
}
