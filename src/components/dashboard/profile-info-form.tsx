"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { TextareaField } from "@/components/ui/textarea-field";
import type { BusinessCategory } from "@/lib/categories";
import { copy } from "@/lib/copy";
import { MX_STATES } from "@/lib/mx-states";
import { CATEGORY_OTHER_MAX } from "@/lib/validators/onboarding";
import { profileInfoSchema, type ProfileInfoData, type ProfileInfoInput } from "@/lib/validators/profile";
import { saveProfileInfoAction } from "@/server/actions/profile";

const t = copy.panel.profile.info;
const b = copy.onboarding.business;
const common = copy.panel.common;

export function ProfileInfoForm({ initial, categories }: { initial: Partial<ProfileInfoInput>; categories: readonly BusinessCategory[] }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInfoInput, unknown, ProfileInfoData>({ resolver: zodResolver(profileInfoSchema), defaultValues: initial });
  const category = useWatch({ control, name: "category" });

  async function onSubmit() {
    setFormError(null);
    setSaved(false);
    // The server validates what the owner typed, not the client's parsed copy.
    const result = await saveProfileInfoAction(getValues());
    if (!result.ok) {
      const field = result.error.field as keyof ProfileInfoInput | undefined;
      if (field && field in initial) setError(field, { message: result.error.message });
      else setFormError(result.error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5" onChange={() => setSaved(false)}>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {saved ? <Alert tone="success">{common.saved}</Alert> : null}

      <Field label={b.name} autoComplete="organization" error={errors.name?.message} {...register("name")} />

      <SelectField label={b.category} placeholder={b.categoryPlaceholder} defaultValue={initial.category ?? ""} error={errors.category?.message} {...register("category")}>
        {categories.map((value) => (
          <option key={value} value={value}>
            {copy.onboarding.categories[value]}
          </option>
        ))}
      </SelectField>

      {category === "other" ? (
        <Field
          label={b.categoryOther}
          placeholder={b.categoryOtherPlaceholder}
          maxLength={CATEGORY_OTHER_MAX}
          autoComplete="off"
          error={errors.categoryOther?.message}
          {...register("categoryOther")}
        />
      ) : null}

      <TextareaField
        label={t.description}
        placeholder={t.descriptionPlaceholder}
        hint={t.descriptionHint}
        maxLength={500}
        rows={4}
        error={errors.description?.message}
        {...register("description")}
      />

      <SelectField label={b.state} placeholder={b.statePlaceholder} defaultValue={initial.state ?? ""} autoComplete="address-level1" error={errors.state?.message} {...register("state")}>
        {MX_STATES.map((state) => (
          <option key={state} value={state}>
            {state}
          </option>
        ))}
      </SelectField>
      <Field label={b.city} autoComplete="address-level2" error={errors.city?.message} {...register("city")} />
      <Field label={t.address} placeholder={t.addressPlaceholder} autoComplete="street-address" error={errors.address?.message} {...register("address")} />
      <Field
        label={t.mapsUrl}
        hint={t.mapsUrlHint}
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoComplete="off"
        placeholder="https://maps.app.goo.gl/…"
        error={errors.mapsUrl?.message}
        {...register("mapsUrl")}
      />

      <h2 className="mt-2 text-lg font-semibold">{t.contactTitle}</h2>
      <Field label={t.phone} hint={t.phoneHint} type="tel" inputMode="tel" autoComplete="tel-national" error={errors.phone?.message} {...register("phone")} />
      <Field label={t.whatsapp} hint={t.whatsappHint} type="tel" inputMode="tel" autoComplete="off" error={errors.whatsapp?.message} {...register("whatsapp")} />
      <Field label={t.email} type="email" inputMode="email" autoComplete="email" error={errors.email?.message} {...register("email")} />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? common.saving : common.save}
      </Button>
    </form>
  );
}
