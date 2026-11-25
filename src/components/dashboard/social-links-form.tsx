"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { copy } from "@/lib/copy";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social";
import { socialLinksSchema, type SocialLinksData, type SocialLinksInput } from "@/lib/validators/profile";
import { saveSocialLinksAction } from "@/server/actions/profile";

const t = copy.panel.profile.social;
const common = copy.panel.common;

export function SocialLinksForm({ initial }: { initial: Record<SocialPlatform, string> }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SocialLinksInput, unknown, SocialLinksData>({ resolver: zodResolver(socialLinksSchema), defaultValues: initial });

  async function onSubmit() {
    setFormError(null);
    setSaved(false);
    const result = await saveSocialLinksAction(getValues());
    if (!result.ok) {
      const field = result.error.field as SocialPlatform | undefined;
      if (field && SOCIAL_PLATFORMS.includes(field)) setError(field, { message: result.error.message });
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

      {SOCIAL_PLATFORMS.map((platform) => (
        <Field
          key={platform}
          label={t.networks[platform]}
          placeholder={platform === "linkedin" ? t.linkedinPlaceholder : t.handlePlaceholder}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          error={errors[platform]?.message}
          {...register(platform)}
        />
      ))}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? common.saving : common.save}
      </Button>
    </form>
  );
}
