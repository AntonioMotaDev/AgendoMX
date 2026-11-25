import { Body, Button, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import { copy } from "@/lib/copy";

export interface ActionEmailProps {
  preview: string;
  greeting: string;
  body: string;
  cta: string;
  url: string;
  expires: string;
  ignore: string;
  /** Link to the owners' privacy notice (only while the legal pages are published). */
  privacyUrl?: string;
}

// Inline styles only: email clients ignore Tailwind/CSS variables.
const colors = { paper: "#f2efe7", surface: "#faf9f6", ink: "#252724", muted: "#6b6a63", brand: "#d76c52" };

/** Single-call-to-action transactional email (verify address, reset password). */
export function ActionEmail({ preview, greeting, body, cta, url, expires, ignore, privacyUrl }: ActionEmailProps) {
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
          <Text style={{ margin: "0 0 24px", fontSize: 16, lineHeight: "24px", color: colors.ink }}>{body}</Text>
          <Section style={{ margin: "0 0 24px" }}>
            <Button
              href={url}
              style={{
                backgroundColor: colors.ink,
                color: colors.surface,
                borderRadius: 10,
                padding: "14px 24px",
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {cta}
            </Button>
          </Section>
          <Text style={{ margin: "0 0 4px", fontSize: 14, color: colors.muted }}>{expires}</Text>
          <Text style={{ margin: "0 0 16px", fontSize: 14, color: colors.muted }}>{ignore}</Text>
          <Hr style={{ borderColor: "#e2ded2" }} />
          <Text style={{ margin: "12px 0 0", fontSize: 12, color: colors.muted }}>
            {copy.email.footer}
            {privacyUrl ? (
              <>
                {" · "}
                <Link href={privacyUrl} style={{ color: colors.muted, textDecoration: "underline" }}>
                  {copy.email.privacyNotice}
                </Link>
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
