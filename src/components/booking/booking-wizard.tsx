"use client";

import { ArrowLeft, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { InlineMarkdown } from "@/components/legal/legal-document";
import { Field } from "@/components/ui/field";
import { copy } from "@/lib/copy";
import { displayLocalDate } from "@/lib/dates";
import { formatMxnShort } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createBookingAction, getSlotsAction, type DayView } from "@/server/actions/booking";
import { TurnstileWidget } from "./turnstile-widget";

const t = copy.public.booking;
const p = copy.public.profile;

export interface WizardService {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number | null;
  priceIsFrom: boolean;
}

interface Props {
  slug: string;
  businessName: string;
  services: WizardService[];
  preselectedServiceId: string | null;
  manualConfirmation: boolean;
  /** null = Turnstile off (local development only; the server decides if that is allowed). */
  turnstileSiteKey: string | null;
  /** Short privacy notice (markdown, already naming the business as controller); null while the legal texts are not published. */
  privacyNotice?: string | null;
  /** Express-authorization text (markdown) for health categories; null when no box is needed. */
  healthConsentNotice?: string | null;
}

type Step = "service" | "when" | "details";

const weekdayFormatter = new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: "UTC" });
const monthFormatter = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" });

function dayParts(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const instant = new Date(Date.UTC(y, m - 1, d, 12));
  return { weekday: weekdayFormatter.format(instant).replace(".", ""), day: d, month: monthFormatter.format(instant).replace(".", "") };
}

export function BookingWizard({ slug, businessName, services, preselectedServiceId, manualConfirmation, turnstileSiteKey, privacyNotice = null, healthConsentNotice = null }: Props) {
  const router = useRouter();
  const formId = useId();
  const initialService = services.find((s) => s.id === preselectedServiceId) ?? (services.length === 1 ? services[0]! : null);

  const [serviceId, setServiceId] = useState<string | null>(initialService?.id ?? null);
  const [step, setStep] = useState<Step>(initialService ? "when" : "service");
  const skipsServiceStep = initialService !== null;

  const [days, setDays] = useState<DayView[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [healthConsent, setHealthConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const needsToken = turnstileSiteKey !== null;

  const service = services.find((s) => s.id === serviceId) ?? null;
  const total = skipsServiceStep ? 2 : 3;
  const position = step === "service" ? 1 : step === "when" ? (skipsServiceStep ? 1 : 2) : total;

  // Applies a slots response. Newer requests win; state changes only once a response arrives.
  const loadRequest = useRef(0);
  const applySlots = useCallback((mine: number, result: Awaited<ReturnType<typeof getSlotsAction>>) => {
    if (mine !== loadRequest.current) return;
    if (!result.ok) {
      setSlotsError(result.error.message);
      setDays([]);
      return;
    }
    setDays(result.data.days);
    setDate(result.data.days[0]?.date ?? null);
    setStart(null);
  }, []);

  // Event handlers reset the visible state first, then ask for slots.
  function reloadSlots(id: string) {
    setDays(null);
    setSlotsError(null);
    setStart(null);
    const mine = ++loadRequest.current;
    void getSlotsAction({ slug, serviceId: id }).then((result) => applySlots(mine, result));
  }

  // First load when the service was already decided (a link from the profile, or a single service).
  const initialServiceId = initialService?.id ?? null;
  useEffect(() => {
    if (!initialServiceId) return;
    const mine = ++loadRequest.current;
    void getSlotsAction({ slug, serviceId: initialServiceId }).then((result) => applySlots(mine, result));
  }, [initialServiceId, slug, applySlots]);

  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  function chooseService(id: string) {
    setServiceId(id);
    setStep("when");
    reloadSlots(id);
  }

  function back() {
    setFormError(null);
    if (step === "details") setStep("when");
    else if (step === "when" && !skipsServiceStep) setStep("service");
    else router.push(`/${slug}`);
  }

  const slotsOfDate = days?.find((d) => d.date === date)?.slots ?? [];
  const selectedSlot = slotsOfDate.find((s) => s.start === start) ?? null;
  const canSubmit = !submitting && start !== null && (!needsToken || token !== null) && (!healthConsentNotice || healthConsent);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!serviceId || !start || submitting) return;
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    const result = await createBookingAction({
      slug,
      serviceId,
      start,
      name,
      phone,
      email,
      website,
      healthConsent: healthConsentNotice ? healthConsent : null,
      turnstileToken: token,
    });
    if (result.ok) {
      router.push(`/cita/${result.data.token}?nueva=1`);
      return; // keep the button disabled while navigating
    }
    // A Turnstile token is single use: always ask for a new one after an attempt.
    setToken(null);
    setResetKey((k) => k + 1);
    setSubmitting(false);
    const { message, field } = result.error;
    if (field === "start") {
      setFormError(message);
      setStep("when");
      reloadSlots(serviceId);
    } else if (field && ["name", "phone", "email", "healthConsent"].includes(field)) {
      setFieldErrors({ [field]: message });
    } else {
      setFormError(message);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={back}
          className="-ml-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink hover:bg-ink/5"
          aria-label={t.back}
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <div>
          <p className="text-sm text-ink-muted">
            {businessName} · {t.stepOf(position, total)}
          </p>
        </div>
      </div>

      <h1 ref={heading} tabIndex={-1} className="mb-4 text-2xl font-semibold tracking-tight text-ink outline-none">
        {step === "service" ? t.stepService : step === "when" ? t.stepDate : t.stepDetails}
      </h1>

      {step === "service" ? (
        <ul className="flex flex-col gap-2" role="radiogroup" aria-label={t.stepService}>
          {services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="radio"
                aria-checked={serviceId === s.id}
                onClick={() => chooseService(s.id)}
                className={cn(
                  "flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border bg-surface p-4 text-left hover:bg-paper",
                  serviceId === s.id ? "border-ink" : "border-line",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-ink">{s.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
                    <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                    {p.minutes(s.durationMin)}
                  </span>
                </span>
                {s.priceCents !== null ? (
                  <span className="shrink-0 text-base font-semibold text-ink">
                    {s.priceIsFrom ? `${p.from} ` : ""}
                    {formatMxnShort(s.priceCents)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {step === "when" ? (
        <div className="flex flex-col gap-5">
          {service ? (
            <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">
              <span className="font-semibold">{service.name}</span> · {p.minutes(service.durationMin)}
              {service.priceCents !== null ? ` · ${service.priceIsFrom ? `${p.from} ` : ""}${formatMxnShort(service.priceCents)}` : ""}
            </p>
          ) : null}
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          {days === null ? (
            <p role="status" className="text-base text-ink-muted">
              {t.loadingSlots}
            </p>
          ) : slotsError ? (
            <Alert tone="error">{slotsError}</Alert>
          ) : days.length === 0 ? (
            <Alert tone="info">{t.noSlots}</Alert>
          ) : (
            <>
              <div>
                <p id={`${formId}-days`} className="mb-2 text-sm font-medium text-ink">
                  {t.pickDay}
                </p>
                <div role="radiogroup" aria-labelledby={`${formId}-days`} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
                  {days.map((d) => {
                    const parts = dayParts(d.date);
                    const selected = d.date === date;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={displayLocalDate(d.date, true)}
                        onClick={() => {
                          setDate(d.date);
                          setStart(null);
                        }}
                        className={cn(
                          "flex min-h-[72px] w-16 shrink-0 flex-col items-center justify-center rounded-lg border text-sm transition-colors",
                          selected ? "border-ink bg-ink text-surface" : "border-stone bg-surface text-ink hover:bg-paper",
                        )}
                      >
                        <span className="capitalize">{parts.weekday}</span>
                        <span className="text-xl font-semibold leading-tight">{parts.day}</span>
                        <span>{parts.month}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p id={`${formId}-times`} className="mb-2 text-sm font-medium text-ink">
                  {t.pickTime}
                </p>
                <div role="radiogroup" aria-labelledby={`${formId}-times`} className="grid grid-cols-3 gap-2">
                  {slotsOfDate.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      role="radio"
                      aria-checked={s.start === start}
                      onClick={() => setStart(s.start)}
                      className={cn(
                        "min-h-11 rounded-md border px-2 text-sm font-medium transition-colors",
                        s.start === start ? "border-ink bg-ink text-surface" : "border-stone bg-surface text-ink hover:bg-paper",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <Button disabled={start === null} onClick={() => setStep("details")}>
            {t.next}
          </Button>
        </div>
      ) : null}

      {step === "details" && service && selectedSlot && date ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="rounded-lg border border-line bg-surface px-4 py-3">
            <p className="text-sm text-ink-muted">{t.summary}</p>
            <p className="text-base font-semibold text-ink">{service.name}</p>
            <p className="text-base text-ink">
              {displayLocalDate(date, true)}, {selectedSlot.label}
            </p>
          </div>
          {manualConfirmation ? <Alert tone="info">{t.manualNotice}</Alert> : null}
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field
            label={t.name}
            name="name"
            autoComplete="name"
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            maxLength={80}
            required
          />
          <Field
            label={t.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="55 1234 5678"
            hint={t.phoneHint}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={fieldErrors.phone}
            maxLength={30}
            required
          />
          <Field
            label={t.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            hint={t.emailHint}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            maxLength={254}
          />
          {/* Honeypot: invisible and unreachable for people; bots fill every input. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>
          {needsToken ? (
            <>
              <TurnstileWidget siteKey={turnstileSiteKey} onToken={setToken} resetKey={resetKey} />
              {token === null ? (
                <p role="status" className="text-sm text-ink-muted">
                  {t.verifying}
                </p>
              ) : null}
            </>
          ) : null}
          {healthConsentNotice ? (
            <CheckboxField
              name="healthConsent"
              checked={healthConsent}
              onChange={(e) => setHealthConsent(e.target.checked)}
              error={fieldErrors.healthConsent}
              label={<InlineMarkdown text={healthConsentNotice} />}
            />
          ) : null}
          {privacyNotice ? (
            <p className="text-xs leading-relaxed text-ink-muted">
              <InlineMarkdown text={privacyNotice} />
            </p>
          ) : null}
          <Button type="submit" disabled={!canSubmit}>
            {submitting ? t.confirming : t.confirm}
          </Button>
        </form>
      ) : null}
    </main>
  );
}
