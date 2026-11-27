import { Body, Column, Container, Head, Hr, Html, Img, Preview, Row, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";

/** Illustration shown at the top of the email (public/brand/email/hero-*.png). */
export type EmailHero = "confirmed" | "pending" | "cancelled" | "reminder" | "verify" | "reset";

// Inline styles only: email clients ignore Tailwind/CSS variables. Dark-mode overrides live in <style> below.
export const emailColors = {
  paper: "#f2efe7",
  surface: "#faf9f6",
  ink: "#252724",
  muted: "#6b6a63",
  soft: "#b7b3a8",
  line: "#e2ded2",
  brand: "#d76c52",
};

const FONT = "'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

// Clients that honor prefers-color-scheme (Apple Mail, iOS, Outlook.com) get these; Gmail applies its own inversion.
const darkCss = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  .hero-dark { display: none; }
  @media (prefers-color-scheme: dark) {
    html, body, .em-bg, body > table > tbody > tr > td { background-color: #1f211e !important; }
    .em-card { background-color: #2d2f2b !important; border-color: #3c3f39 !important; }
    .em-inset { background-color: #252724 !important; }
    .em-ink { color: #f2efe7 !important; }
    .em-muted { color: #b7b3a8 !important; }
    .em-line { border-color: #3c3f39 !important; }
    .em-button { background-color: #f2efe7 !important; color: #252724 !important; }
    .hero-light { display: none !important; }
    .hero-dark { display: block !important; }
  }
`;

const assetUrl = (file: string) => `${appUrl()}/brand/email/${file}`;

export interface EmailLayoutProps {
  preview: string;
  hero: EmailHero;
  children: ReactNode;
}

/** Shared frame for every transactional email: isotipo header, illustration, content, soft signature. */
export function EmailLayout({ preview, hero, children }: EmailLayoutProps) {
  const e = copy.email;
  return (
    <Html lang="es-MX">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body className="em-bg" style={{ backgroundColor: emailColors.paper, margin: 0, padding: "24px 12px", fontFamily: FONT }}>
        <Container style={{ maxWidth: 480 }}>
          <Section className="em-card" style={{ backgroundColor: emailColors.surface, border: `1px solid ${emailColors.line}`, borderRadius: 16, overflow: "hidden" }}>
            <Section style={{ backgroundColor: emailColors.brand, height: 4, lineHeight: "4px", fontSize: 4 }}>&nbsp;</Section>
            <Section style={{ padding: "22px 28px 18px" }}>
              <Row>
                <Column style={{ width: 36, verticalAlign: "middle" }}>
                  <Img src={assetUrl("isotipo.png")} width={28} height={28} alt="" style={{ display: "block" }} />
                </Column>
                <Column style={{ verticalAlign: "middle" }}>
                  <Text className="em-ink" style={{ margin: 0, fontSize: 22, lineHeight: "28px", fontWeight: 700, letterSpacing: "-0.02em", color: emailColors.ink }}>
                    agendo<span style={{ color: emailColors.brand }}>mx</span>
                  </Text>
                </Column>
              </Row>
            </Section>
            <Img className="hero-light" src={assetUrl(`hero-${hero}.png`)} width={480} alt="" style={{ display: "block", width: "100%", maxWidth: 480, height: "auto" }} />
            <Img className="hero-dark" src={assetUrl(`hero-${hero}-dark.png`)} width={480} alt="" style={{ display: "none", width: "100%", maxWidth: 480, height: "auto" }} />
            <Section style={{ padding: "28px 28px 8px" }}>{children}</Section>
            <Section style={{ padding: "0 28px 28px" }}>
              <Hr className="em-line" style={{ borderColor: emailColors.line, margin: "8px 0 20px" }} />
              <Row>
                <Column style={{ width: 28, verticalAlign: "top" }}>
                  <Img src={assetUrl("isotipo-soft.png")} width={16} height={16} alt="" style={{ display: "block", marginTop: 3 }} />
                </Column>
                <Column style={{ verticalAlign: "top" }}>
                  <Text className="em-muted" style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: emailColors.muted }}>
                    {e.signatureLine}
                    <br />
                    <span className="em-ink" style={{ fontWeight: 600, color: emailColors.ink }}>
                      {e.signatureName}
                    </span>
                  </Text>
                </Column>
              </Row>
            </Section>
          </Section>
          <Section style={{ padding: "20px 12px 0", textAlign: "center" }}>
            <Text className="em-muted" style={{ margin: "0 0 4px", fontSize: 12, lineHeight: "18px", color: emailColors.muted }}>
              {e.tagline}
            </Text>
            <Text style={{ margin: 0, fontSize: 11, lineHeight: "16px", color: emailColors.soft }}>{e.credit}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Heading + paragraph used by every template. */
export function EmailIntro({ greeting, body }: { greeting: string; body: string }) {
  return (
    <>
      <Text className="em-ink" style={{ margin: "0 0 10px", fontSize: 24, lineHeight: "30px", fontWeight: 700, letterSpacing: "-0.02em", color: emailColors.ink }}>
        {greeting}
      </Text>
      <Text className="em-ink" style={{ margin: "0 0 24px", fontSize: 16, lineHeight: "25px", color: emailColors.ink }}>
        {body}
      </Text>
    </>
  );
}

export const emailButtonStyle = {
  backgroundColor: emailColors.ink,
  color: emailColors.surface,
  borderRadius: 12,
  padding: "15px 28px",
  fontSize: 16,
  fontWeight: 600,
  textDecoration: "none",
  fontFamily: FONT,
} as const;
