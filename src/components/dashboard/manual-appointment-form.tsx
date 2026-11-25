"use client";

import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { copy } from "@/lib/copy";
import { displayLocalDate } from "@/lib/dates";
import { formatMxnShort } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createManualAppointmentAction, getManualSlotsAction } from "@/server/actions/appointments";
import type { DayView } from "@/server/actions/booking";

const t = copy.panel.agenda.manual;
const p = copy.public.profile;

export interface ManualService {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number | null;
}

const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" });
function dayParts(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  return { weekday: weekday.format(at).replace(".", ""), day: d, month: month.format(at).replace(".", "") };
}

export function ManualAppointmentForm({ services, today }: { services: ManualService[]; today: string }) {
  const router = useRouter();
  const formId = useId();
  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? "");
  const [custom, setCustom] = useState(false);
  const [days, setDays] = useState<DayView[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState(today);
  const [customTime, setCustomTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Newer requests win: a slow answer for a service the owner already left must not overwrite the list.
  const request = useRef(0);
  const load = (id: string) => {
    const mine = ++request.current;
    setDays(null);
    setSlotsError(null);
    setStart(null);
    void getManualSlotsAction({ serviceId: id }).then((result) => {
      if (mine !== request.current) return;
      if (!result.ok) {
        setSlotsError(result.error.message);
        setDays([]);
        return;
      }
      setDays(result.data.days);
      setDate(result.data.days[0]?.date ?? null);
    });
  };

  useEffect(() => {
    if (!serviceId) return;
    const mine = ++request.current;
    void getManualSlotsAction({ serviceId }).then((result) => {
      if (mine !== request.current) return;
      if (!result.ok) {
        setSlotsError(result.error.message);
        setDays([]);
        return;
      }
      setDays(result.data.days);
      setDate(result.data.days[0]?.date ?? null);
    });
  }, [serviceId]);

  const slots = days?.find((d) => d.date === date)?.slots ?? [];
  const ready = custom ? customDate !== "" && customTime !== "" : start !== null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !ready) return;
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    const result = await createManualAppointmentAction({
      serviceId,
      mode: custom ? "custom" : "slot",
      start,
      date: customDate,
      time: customTime,
      name,
      phone,
      email,
    });
    if (result.ok) {
      const day = custom ? customDate : (date ?? today);
      router.push(`/app/semana?s=${day}`);
      return;
    }
    setSubmitting(false);
    const { message, field } = result.error;
    if (field && ["name", "phone", "email", "time"].includes(field)) setErrors({ [field]: message });
    else {
      setFormError(message);
      if (field === "start") load(serviceId); // the slot was taken: show what is free now
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">{t.service}</legend>
        <div role="radiogroup" aria-label={t.service} className="flex flex-col gap-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={serviceId === s.id}
              onClick={() => {
                setServiceId(s.id);
                load(s.id);
              }}
              className={cn(
                "flex min-h-12 items-center justify-between gap-3 rounded-lg border bg-surface p-3 text-left",
                serviceId === s.id ? "border-ink" : "border-line hover:bg-paper",
              )}
            >
              <span>
                <span className="block text-base font-semibold text-ink">{s.name}</span>
                <span className="flex items-center gap-1 text-sm text-ink-muted">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                  {p.minutes(s.durationMin)}
                </span>
              </span>
              {s.priceCents !== null ? <span className="text-base font-semibold text-ink">{formatMxnShort(s.priceCents)}</span> : null}
            </button>
          ))}
        </div>
      </fieldset>

      <section className="flex flex-col gap-3" aria-labelledby={`${formId}-when`}>
        <h2 id={`${formId}-when`} className="text-lg font-semibold text-ink">
          {t.whenTitle}
        </h2>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        {custom ? (
          <>
            <p className="text-sm text-ink-muted">{t.customHint}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.date} name="date" type="date" min={today} value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              <Field label={t.time} name="time" type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} error={errors.time} />
            </div>
          </>
        ) : days === null ? (
          <p role="status" className="text-base text-ink-muted">
            {t.loadingSlots}
          </p>
        ) : slotsError ? (
          <Alert tone="error">{slotsError}</Alert>
        ) : days.length === 0 ? (
          <Alert tone="info">{t.noSlots}</Alert>
        ) : (
          <>
            <div role="radiogroup" aria-label={t.pickDay} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
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
                      "flex min-h-[72px] w-16 shrink-0 flex-col items-center justify-center rounded-lg border text-sm",
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
            <div role="radiogroup" aria-label={t.pickTime} className="grid grid-cols-3 gap-2">
              {slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  role="radio"
                  aria-checked={s.start === start}
                  onClick={() => setStart(s.start)}
                  className={cn("min-h-11 rounded-md border px-2 text-sm font-medium", s.start === start ? "border-ink bg-ink text-surface" : "border-stone bg-surface text-ink hover:bg-paper")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        <button type="button" onClick={() => setCustom((c) => !c)} className="min-h-11 self-start text-sm font-semibold text-brand-ink underline underline-offset-4">
          {custom ? t.customOff : t.customOn}
        </button>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby={`${formId}-client`}>
        <h2 id={`${formId}-client`} className="text-lg font-semibold text-ink">
          {t.clientTitle}
        </h2>
        <Field label={t.name} name="name" autoComplete="off" placeholder={t.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={80} required />
        <Field label={t.phone} name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="55 1234 5678" hint={t.phoneHint} value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} maxLength={30} required />
        <Field label={t.email} name="email" type="email" inputMode="email" autoComplete="off" hint={t.emailHint} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} maxLength={254} />
      </section>

      <Button type="submit" disabled={submitting || !ready}>
        {submitting ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
