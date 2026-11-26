"use client";

import { ArrowLeft, Check, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { InlineMarkdown } from "@/components/legal/legal-document";
import { Notice } from "@/components/public/notice";
import { ThemedField } from "@/components/public/themed-field";
import { copy } from "@/lib/copy";
import { displayLocalDate } from "@/lib/dates";
import { formatMxnShort } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createBookingAction, getSlotsAction, type DayView } from "@/server/actions/booking";
import { MonthCalendar } from "./month-calendar";
import { groupSlots } from "./slot-groups";
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
  /** "Address, City" shown in the summary; null when the business has none. */
  businessPlace: string | null;
  services: WizardService[];
  preselectedServiceId: string | null;
  manualConfirmation: boolean;
  /** null = Turnstile off (local development only; the server decides if that is allowed). */
  turnstileSiteKey: string | null;
  /** Short privacy notice (markdown, already naming the business as controller); null while the legal texts are not published. */
  privacyNotice?: string | null;
}

type Step = "service" | "when" | "details";

const PART_LABEL = { morning: t.morning, afternoon: t.afternoon, evening: t.evening } as const;

const priceOf = (s: WizardService) => (s.priceCents === null ? null : `${s.priceIsFrom ? `${p.from} ` : ""}${formatMxnShort(s.priceCents)}`);

const primaryButton =
  "flex min-h-[52px] w-full items-center justify-center whitespace-nowrap rounded-[14px] bg-th-primary px-6 text-base font-bold text-th-onp transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100";

export function BookingWizard({ slug, businessName, businessPlace, services, preselectedServiceId, manualConfirmation, turnstileSiteKey, privacyNotice = null }: Props) {
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const needsToken = turnstileSiteKey !== null;

  const service = services.find((s) => s.id === serviceId) ?? null;
  const steps: Step[] = skipsServiceStep ? ["when", "details"] : ["service", "when", "details"];
  const total = steps.length;
  const position = steps.indexOf(step) + 1;
  const stepName = t.stepLabels[step];

  // Applies a slots response. Newer requests win; state changes only once a response arrives.
  const loadRequest = useRef(0);
  // Day to go back to when the next answer arrives (after "that time was just taken"); null = the first open day.
  const dayToKeep = useRef<string | null>(null);
  const applySlots = useCallback((mine: number, result: Awaited<ReturnType<typeof getSlotsAction>>) => {
    if (mine !== loadRequest.current) return;
    if (!result.ok) {
      setSlotsError(result.error.message);
      setDays([]);
      return;
    }
    const keep = dayToKeep.current;
    dayToKeep.current = null;
    setDays(result.data.days);
    setDate(keep && result.data.days.some((d) => d.date === keep) ? keep : (result.data.days[0]?.date ?? null));
    setStart(null);
  }, []);

  // Event handlers reset the visible state first, then ask for slots.
  // `keepDay`: stay on the day the person was looking at (a taken slot should not throw them back to the first day).
  function reloadSlots(id: string, keepDay = false) {
    dayToKeep.current = keepDay ? date : null;
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
  const canSubmit = !submitting && start !== null && (!needsToken || token !== null);

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
      reloadSlots(serviceId, true);
    } else if (field && ["name", "phone", "email"].includes(field)) {
      setFieldErrors({ [field]: message });
    } else {
      setFormError(message);
    }
  }

  /** The step's main action, rendered twice (summary card on wide screens, bottom bar on narrow ones); only one is ever visible. */
  const action =
    step === "when" ? (
      // Distinct keys: this node must not be reused for the submit button below, or the click that
      // opens the details step would also submit the (still empty) form.
      <button key="next" type="button" className={primaryButton} disabled={start === null} onClick={() => setStep("details")}>
        {t.next}
      </button>
    ) : step === "details" ? (
      <button key="submit" type="submit" form={`${formId}-details`} className={primaryButton} disabled={!canSubmit}>
        {submitting ? t.confirming : t.confirm}
      </button>
    ) : null;

  const dayId = `${formId}-days`;
  const timeId = `${formId}-times`;

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-th-line bg-th-bg/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[1104px] px-4 pb-3 pt-2 sm:px-7 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={back}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-th-line bg-th-surface text-th-text hover:bg-th-soft"
              aria-label={t.back}
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold text-th-text">{businessName}</p>
              <p className="text-xs text-th-muted">
                {t.stepOf(position, total)} · {stepName}
              </p>
            </div>
          </div>
          <ol aria-label={t.stepsLabel} className="mt-2.5 flex gap-1.5">
            {steps.map((s, i) => (
              <li key={s} aria-current={s === step ? "step" : undefined} className="flex-1">
                <span className={cn("block h-1 rounded-full", i + 1 <= position ? "bg-th-primary" : "bg-th-line")} />
                <span className={cn("mt-1.5 text-xs", s === step ? "block font-extrabold text-th-text" : "hidden font-semibold text-th-muted sm:block")}>{t.stepLabels[s]}</span>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1104px] flex-1 content-start gap-6 px-4 pb-32 pt-5 sm:px-7 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-11 lg:px-8 lg:pb-12 lg:pt-8">
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <h1 ref={heading} tabIndex={-1} className="text-2xl font-extrabold leading-tight tracking-tight text-th-text outline-none">
              {step === "service" ? t.stepService : step === "when" ? t.stepDate : t.stepDetails}
            </h1>
            {step === "when" && service ? (
              <p className="mt-1 text-sm text-th-muted">
                {service.name} · {p.minutes(service.durationMin)}
              </p>
            ) : null}
          </div>

          {step === "service" ? (
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1" role="radiogroup" aria-label={t.stepService}>
              {services.map((s) => {
                const on = serviceId === s.id;
                const price = priceOf(s);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => chooseService(s.id)}
                      className={cn(
                        "grid min-h-[76px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-[18px] border border-th-line bg-th-surface px-4 py-3.5 text-left hover:bg-th-soft",
                        on && "border-transparent ring-2 ring-th-primary",
                      )}
                    >
                      <span aria-hidden="true" className={cn("flex h-[22px] w-[22px] items-center justify-center rounded-full border-2", on ? "border-th-primary bg-th-primary text-th-onp" : "border-th-muted")}>
                        {on ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-bold text-th-text">{s.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[13px] text-th-muted">
                          <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                          {p.minutes(s.durationMin)}
                        </span>
                      </span>
                      {price ? <span className="shrink-0 text-base font-extrabold tabular-nums text-th-text">{price}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {step === "when" ? (
            <div className="flex flex-col gap-5">
              {formError ? <Notice tone="error">{formError}</Notice> : null}
              {days === null ? (
                <p role="status" className="text-base text-th-muted">
                  {t.loadingSlots}
                </p>
              ) : slotsError ? (
                <Notice tone="error">{slotsError}</Notice>
              ) : days.length === 0 ? (
                <Notice tone="info">{t.noSlots}</Notice>
              ) : (
                <div className="grid gap-6 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)] sm:gap-7">
                  <div>
                    <p id={dayId} className="mb-2 text-sm font-bold text-th-text">
                      {t.pickDay}
                    </p>
                    <MonthCalendar
                      availableDates={days.map((d) => d.date)}
                      selected={date}
                      onSelect={(d) => {
                        setDate(d);
                        setStart(null);
                      }}
                      labelledBy={dayId}
                    />
                  </div>
                  <div>
                    <p id={timeId} className="mb-2 text-sm font-bold text-th-text">
                      {t.pickTime}
                      {date ? <span className="font-medium text-th-muted"> · {displayLocalDate(date, true)}</span> : null}
                    </p>
                    <div role="radiogroup" aria-labelledby={timeId} className="flex flex-col gap-5">
                      {groupSlots(slotsOfDate).map((group) => (
                        <div key={group.part ?? "all"}>
                          {group.part ? <p aria-hidden="true" className="mb-2 text-xs font-bold uppercase tracking-wider text-th-muted">{PART_LABEL[group.part]}</p> : null}
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))]">
                            {group.slots.map((s) => (
                              <button
                                key={s.start}
                                type="button"
                                role="radio"
                                aria-checked={s.start === start}
                                onClick={() => setStart(s.start)}
                                className={cn(
                                  "min-h-12 whitespace-nowrap rounded-xl border px-1 text-[15px] font-bold tabular-nums",
                                  s.start === start ? "border-th-primary bg-th-primary text-th-onp" : "border-th-line bg-th-surface text-th-text hover:bg-th-soft",
                                )}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {step === "details" && service && selectedSlot && date ? (
            <div className="rounded-2xl border border-th-line bg-th-surface px-4 py-3 lg:hidden">
              <p className="text-xs text-th-muted">{t.summary}</p>
              <p className="text-base font-bold text-th-text">{service.name}</p>
              <p className="text-sm text-th-text">
                {displayLocalDate(date, true)}, {selectedSlot.label}
              </p>
            </div>
          ) : null}

          {step === "details" && service && selectedSlot && date ? (
            <form id={`${formId}-details`} onSubmit={submit} noValidate className="flex flex-col gap-4">
              {manualConfirmation ? <Notice tone="info">{t.manualNotice}</Notice> : null}
              {formError ? <Notice tone="error">{formError}</Notice> : null}
              <ThemedField
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
              <ThemedField
                label={t.phone}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="55 1234 5678"
                leading="+52"
                hint={t.phoneHint}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={fieldErrors.phone}
                maxLength={30}
                required
              />
              <ThemedField
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
                    <p role="status" className="text-sm text-th-muted">
                      {t.verifying}
                    </p>
                  ) : null}
                </>
              ) : null}
              {privacyNotice ? (
                <p className="text-xs leading-relaxed text-th-muted">
                  <InlineMarkdown text={privacyNotice} />
                </p>
              ) : null}
            </form>
          ) : null}
        </div>

        {/* Summary: a card beside the form on wide screens. On narrow ones the bottom bar carries the essentials. */}
        <aside aria-label={t.summary} className="hidden self-start rounded-[20px] border border-th-line bg-th-surface p-5 lg:sticky lg:top-24 lg:grid lg:gap-3">
          <h2 className="text-base font-extrabold text-th-text">{t.summary}</h2>
          <dl className="grid gap-2.5 text-sm">
            <SummaryRow label={t.summaryService} value={service?.name} />
            <SummaryRow label={t.summaryDay} value={date ? displayLocalDate(date, true) : undefined} />
            <SummaryRow label={t.summaryTime} value={selectedSlot?.label} />
            <SummaryRow label={t.summaryDuration} value={service ? p.minutes(service.durationMin) : undefined} />
            {businessPlace ? <SummaryRow label={t.summaryPlace} value={businessPlace} /> : null}
            <div className="flex justify-between gap-3 border-t border-th-line pt-3 text-base">
              <dt className="text-th-muted">{t.summaryTotal}</dt>
              <dd className="font-extrabold tabular-nums text-th-text">{service ? (priceOf(service) ?? "—") : "—"}</dd>
            </div>
          </dl>
          {action}
        </aside>
      </div>

      {action ? (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-th-line bg-th-bg/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center gap-3.5 sm:justify-end">
            <p className="min-w-0 flex-1 text-xs leading-snug text-th-muted sm:flex-none sm:text-right">
              <span className="block truncate">{service?.name}</span>
              <b className="block truncate text-[15px] font-extrabold tabular-nums text-th-text">
                {step === "details" ? (service ? (priceOf(service) ?? "") : "") : selectedSlot && date ? `${displayLocalDate(date)} · ${selectedSlot.label}` : t.summaryEmpty}
              </b>
            </p>
            <div className="shrink-0 sm:w-60">{action}</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-th-muted">{label}</dt>
      <dd className={cn("text-right", value ? "font-bold text-th-text" : "text-th-muted")}>{value ?? t.summaryEmpty}</dd>
    </div>
  );
}
