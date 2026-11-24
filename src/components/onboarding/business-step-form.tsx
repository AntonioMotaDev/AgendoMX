"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { BUSINESS_CATEGORIES } from "@/lib/categories";
import { copy } from "@/lib/copy";
import { MX_STATES } from "@/lib/mx-states";
import { slugify } from "@/lib/reserved-slugs";
import {
  businessStepSchema,
  CATEGORY_OTHER_MAX,
  type BusinessStepData,
  type BusinessStepInput,
} from "@/lib/validators/onboarding";
import { saveBusinessStepAction } from "@/server/actions/onboarding";
import { SlugStatus, useSlugStatus } from "./slug-status";

const c = copy.onboarding;

export function BusinessStepForm({ initial, publicHost }: { initial: Partial<BusinessStepInput>; publicHost: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // Once the owner edits the link by hand (or already has one), stop deriving it from the name.
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<BusinessStepInput, unknown, BusinessStepData>({
    resolver: zodResolver(businessStepSchema),
    defaultValues: {
      name: initial.name ?? "",
      category: initial.category,
      categoryOther: initial.categoryOther ?? "",
      state: initial.state,
      city: initial.city ?? "",
      slug: initial.slug ?? "",
    },
  });

  const name = useWatch({ control, name: "name" });
  const category = useWatch({ control, name: "category" });
  const slug = useWatch({ control, name: "slug" });

  useEffect(() => {
    if (!slugTouched) setValue("slug", slugify(name ?? ""));
  }, [name, slugTouched, setValue]);

  const { state: slugState, markTaken } = useSlugStatus(slug);

  async function onSubmit() {
    setFormError(null);
    // Send what the owner typed, not the parsed copy: the server validates it again from scratch.
    const result = await saveBusinessStepAction(getValues());
    if (!result.ok) {
      if (result.error.field === "slug") {
        markTaken();
        setError("slug", { message: result.error.message });
      } else {
        setFormError(result.error.message);
      }
      return;
    }
    router.push("/app/onboarding?paso=2");
  }

  const slugField = register("slug", { onChange: () => setSlugTouched(true) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <Field
        label={c.business.name}
        placeholder={c.business.namePlaceholder}
        autoComplete="organization"
        error={errors.name?.message}
        {...register("name")}
      />

      <SelectField
        label={c.business.category}
        placeholder={c.business.categoryPlaceholder}
        defaultValue={initial.category ?? ""}
        error={errors.category?.message}
        {...register("category")}
      >
        {BUSINESS_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {c.categories[category]}
          </option>
        ))}
      </SelectField>

      {category === "other" ? (
        <Field
          label={c.business.categoryOther}
          placeholder={c.business.categoryOtherPlaceholder}
          maxLength={CATEGORY_OTHER_MAX}
          autoComplete="off"
          error={errors.categoryOther?.message}
          {...register("categoryOther")}
        />
      ) : null}

      <SelectField
        label={c.business.state}
        placeholder={c.business.statePlaceholder}
        defaultValue={initial.state ?? ""}
        autoComplete="address-level1"
        error={errors.state?.message}
        {...register("state")}
      >
        {MX_STATES.map((state) => (
          <option key={state} value={state}>
            {state}
          </option>
        ))}
      </SelectField>

      <Field
        label={c.business.city}
        placeholder={c.business.cityPlaceholder}
        autoComplete="address-level2"
        error={errors.city?.message}
        {...register("city")}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-sm font-medium text-ink">
          {c.business.slug}
        </label>
        <div
          className={`flex min-h-12 items-center rounded-md border bg-surface px-3.5 ${errors.slug || slugState.kind === "taken" || slugState.kind === "invalid" ? "border-danger" : "border-stone"}`}
        >
          <span className="shrink-0 text-base text-ink-muted">{publicHost}/</span>
          <input
            id="slug"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="slug-hint slug-status"
            aria-invalid={errors.slug ? true : undefined}
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink focus-visible:outline-none"
            {...slugField}
          />
        </div>
        <p id="slug-hint" className="text-sm text-ink-muted">
          {c.business.slugHint}
        </p>
        <p id="slug-status" role="status" aria-live="polite" className="min-h-5 text-sm">
          <SlugStatus state={slugState} serverError={errors.slug?.message} />
        </p>
      </div>

      <Button type="submit" disabled={isSubmitting || slugState.kind === "taken"}>
        {isSubmitting ? c.shell.saving : c.shell.next}
      </Button>
    </form>
  );
}
