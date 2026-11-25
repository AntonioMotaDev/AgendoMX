import type { Metadata } from "next";
import { WeekScreen } from "@/components/dashboard/week-screen";
import { parseLocalDateOrNull } from "@/lib/time";

export const metadata: Metadata = { title: "Semana — AgendoMX", robots: { index: false } };

export default async function WeekPage({ searchParams }: PageProps<"/app/semana">) {
  const { s } = await searchParams;
  return <WeekScreen focus={parseLocalDateOrNull(Array.isArray(s) ? s[0] : s)} />;
}
