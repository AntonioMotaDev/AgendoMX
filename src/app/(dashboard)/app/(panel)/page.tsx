import type { Metadata } from "next";
import { AgendaScreen } from "@/components/dashboard/agenda-screen";

export const metadata: Metadata = { title: "Hoy — AgendoMX", robots: { index: false } };

export default function TodayPage() {
  return <AgendaScreen day="today" />;
}
