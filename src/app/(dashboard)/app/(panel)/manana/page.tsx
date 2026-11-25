import type { Metadata } from "next";
import { AgendaScreen } from "@/components/dashboard/agenda-screen";

export const metadata: Metadata = { title: "Mañana — AgendoMX", robots: { index: false } };

export default function TomorrowPage() {
  return <AgendaScreen day="tomorrow" />;
}
