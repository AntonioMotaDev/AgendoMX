import { copy } from "@/lib/copy";
import { formatDuration, type AgendaCardData } from "@/server/services/agenda-view";
import { AppointmentCard } from "./appointment-card";

const t = copy.panel.agenda;

export interface TimelineRow {
  card: AgendaCardData;
  /** Free minutes since the previous appointment, when long enough to show. */
  gapBefore: number | null;
  isNext: boolean;
  /** "en 18 min", only for the next appointment. */
  until: string | null;
}

/**
 * The day as a time line: start and end on the left, a dot and a line, then the
 * appointment. Free gaps between appointments are shown so the owner sees where they could fit someone.
 */
export function AgendaTimeline({ rows, openAll = false }: { rows: TimelineRow[]; openAll?: boolean }) {
  return (
    <ul className="flex flex-col">
      {rows.map((row, i) => (
        <TimelineItem key={row.card.id} row={row} first={i === 0} last={i === rows.length - 1} openAll={openAll} />
      ))}
    </ul>
  );
}

function TimelineItem({ row, first, last, openAll }: { row: TimelineRow; first: boolean; last: boolean; openAll: boolean }) {
  return (
    <>
      {row.gapBefore !== null ? (
        <li className="grid min-h-[30px] grid-cols-[50px_14px_minmax(0,1fr)] items-center gap-x-2.5" aria-hidden="false">
          <span />
          <span aria-hidden="true" className="relative h-full">
            <span className="absolute bottom-0 left-1.5 top-0 w-0.5 bg-line" />
          </span>
          <p className="text-xs text-ink-muted">{t.free(formatDuration(row.gapBefore))}</p>
        </li>
      ) : null}
      <AppointmentCard card={row.card} first={first} last={last} isNext={row.isNext} untilLabel={row.until} defaultOpen={openAll || row.isNext} />
    </>
  );
}
