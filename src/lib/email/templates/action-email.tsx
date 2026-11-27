import { Button, Section, Text } from "@react-email/components";
import { EmailIntro, EmailLayout, emailButtonStyle, emailColors, type EmailHero } from "./email-layout";

export interface ActionEmailProps {
  preview: string;
  greeting: string;
  body: string;
  cta: string;
  url: string;
  expires: string;
  ignore: string;
  hero: Extract<EmailHero, "verify" | "reset">;
}

/** Single-call-to-action transactional email (verify address, reset password). */
export function ActionEmail({ preview, greeting, body, cta, url, expires, ignore, hero }: ActionEmailProps) {
  return (
    <EmailLayout preview={preview} hero={hero}>
      <EmailIntro greeting={greeting} body={body} />
      <Section style={{ margin: "0 0 24px" }}>
        <Button className="em-button" href={url} style={emailButtonStyle}>
          {cta}
        </Button>
      </Section>
      <Text className="em-muted" style={{ margin: "0 0 4px", fontSize: 14, lineHeight: "21px", color: emailColors.muted }}>
        {expires}
      </Text>
      <Text className="em-muted" style={{ margin: "0 0 16px", fontSize: 14, lineHeight: "21px", color: emailColors.muted }}>
        {ignore}
      </Text>
    </EmailLayout>
  );
}
