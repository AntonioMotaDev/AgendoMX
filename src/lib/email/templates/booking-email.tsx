import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import { copy } from "@/lib/copy";

export interface BookingEmailProps {
  preview: string;
  greeting: string;
  body: string;
  /** Label/value rows (when, service, where…). */
  details: ReadonlyArray<{ label: string; value: string }>;
  cta: string;
  url: string;
  note?: string;
}

// Inline styles only: email clients ignore Tailwind/CSS variables.
const colors = { paper: "#f2efe7", surface: "#faf9f6", ink: "#252724", muted: "#6b6a63", brand: "#d76c52" };

/** Transactional email about one appointment, with a detail table and a single call to action. */
export function BookingEmail({ preview, greeting, body, details, cta, url, note }: BookingEmailProps) {
  return (
    <Html lang="es-MX">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.paper, margin: 0, padding: "24px 12px", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container style={{ backgroundColor: colors.surface, borderRadius: 14, padding: "32px 24px", maxWidth: 480 }}>
          <Text style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 700, color: colors.ink }}>
            agendo<span style={{ color: colors.brand }}>mx</span>
          </Text>
          <Text style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: colors.ink }}>{greeting}</Text>
          <Text style={{ margin: "0 0 20px", fontSize: 16, lineHeight: "24px", color: colors.ink }}>{body}</Text>
          <Section style={{ margin: "0 0 24px", padding: "4px 16px", backgroundColor: colors.paper, borderRadius: 10 }}>
            {details.map((row) => (
              <Text key={row.label} style={{ margin: "10px 0", fontSize: 15, lineHeight: "22px", color: colors.ink }}>
                <span style={{ display: "block", fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{row.label}</span>
                {row.value}
              </Text>
            ))}
          </Section>
          <Section style={{ margin: "0 0 24px" }}>
            <Button
              href={url}
              style={{ backgroundColor: colors.ink, color: colors.surface, borderRadius: 10, padding: "14px 24px", fontSize: 16, fontWeight: 600, textDecoration: "none" }}
            >
              {cta}
            </Button>
          </Section>
          {note ? <Text style={{ margin: "0 0 16px", fontSize: 14, color: colors.muted }}>{note}</Text> : null}
          <Hr style={{ borderColor: "#e2ded2" }} />
          <Text style={{ margin: "12px 0 0", fontSize: 12, color: colors.muted }}>{copy.email.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
