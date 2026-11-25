import "server-only";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { legalPublished } from "@/lib/legal";
import { ActionEmail } from "./templates/action-email";
import { sendEmail } from "./send";

type Kind = "verify" | "reset";

export function sendAuthEmail(kind: Kind, user: { name: string; email: string }, url: string) {
  const c = copy.email[kind];
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const privacyUrl = legalPublished() ? `${appUrl()}/privacidad` : undefined;
  return sendEmail({
    to: user.email,
    subject: c.subject,
    text: `${c.greeting(firstName)}\n\n${c.body}\n\n${c.cta}: ${url}\n\n${c.expires}\n${c.ignore}\n\n${copy.email.footer}${privacyUrl ? `\n${copy.email.privacyNotice}: ${privacyUrl}` : ""}`,
    react: (
      <ActionEmail
        preview={c.preview}
        greeting={c.greeting(firstName)}
        body={c.body}
        cta={c.cta}
        url={url}
        expires={c.expires}
        ignore={c.ignore}
        privacyUrl={privacyUrl}
      />
    ),
  });
}
