import { Button, Section, Text } from "@react-email/components";
import { EmailIntro, EmailLayout, emailButtonStyle, emailColors, type EmailHero } from "./email-layout";

export interface BookingDetail {
  label: string;
  value: string;
  /** The date/time row: shown large in its own highlighted block. */
  emphasis?: boolean;
}

export interface BookingEmailProps {
  preview: string;
  greeting: string;
  body: string;
  /** Label/value rows (when, service, where…). */
  details: ReadonlyArray<BookingDetail>;
  cta: string;
  url: string;
  note?: string;
  hero: Extract<EmailHero, "confirmed" | "pending" | "cancelled" | "reminder">;
}

const labelStyle = { display: "block", fontSize: 11, lineHeight: "16px", letterSpacing: "0.08em", textTransform: "uppercase", color: emailColors.muted, fontWeight: 600 } as const;

/** Transactional email about one appointment: highlighted date, detail rows and a single call to action. */
export function BookingEmail({ preview, greeting, body, details, cta, url, note, hero }: BookingEmailProps) {
  const lead = details.find((d) => d.emphasis);
  const rest = details.filter((d) => d !== lead);
  return (
    <EmailLayout preview={preview} hero={hero}>
      <EmailIntro greeting={greeting} body={body} />
      {lead ? (
        <Section className="em-inset" style={{ margin: "0 0 12px", padding: "14px 18px", backgroundColor: emailColors.paper, borderLeft: `4px solid ${emailColors.brand}`, borderRadius: 10 }}>
          <Text className="em-muted" style={{ margin: 0, ...labelStyle }}>
            {lead.label}
          </Text>
          <Text className="em-ink" style={{ margin: "4px 0 0", fontSize: 19, lineHeight: "26px", fontWeight: 700, color: emailColors.ink }}>
            {lead.value}
          </Text>
        </Section>
      ) : null}
      {rest.length ? (
        <Section className="em-inset" style={{ margin: "0 0 24px", padding: "6px 18px", backgroundColor: emailColors.paper, borderRadius: 10 }}>
          {rest.map((row, i) => (
            <Text
              key={row.label}
              className="em-ink em-line"
              style={{ margin: 0, padding: "12px 0", fontSize: 15, lineHeight: "22px", color: emailColors.ink, borderTop: i === 0 ? "none" : `1px solid ${emailColors.line}` }}
            >
              <span className="em-muted" style={{ ...labelStyle, marginBottom: 2 }}>
                {row.label}
              </span>
              {row.value}
            </Text>
          ))}
        </Section>
      ) : (
        <Section style={{ height: 12 }} />
      )}
      <Section style={{ margin: "0 0 24px" }}>
        <Button className="em-button" href={url} style={emailButtonStyle}>
          {cta}
        </Button>
      </Section>
      {note ? (
        <Text className="em-muted" style={{ margin: "0 0 16px", fontSize: 14, lineHeight: "21px", color: emailColors.muted }}>
          {note}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
