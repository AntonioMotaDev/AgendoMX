import { Logo } from "@/components/ui/logo";
import { copy } from "@/lib/copy";

export default function AppointmentNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Logo />
      <h1 className="text-xl font-semibold text-ink">{copy.public.appointment.notFoundTitle}</h1>
      <p className="text-base text-ink-muted">{copy.public.appointment.notFoundBody}</p>
    </main>
  );
}
