import "server-only";
import { deliver, type MailMessage, type MailResult } from "./mail-transport";

/**
 * Sends one email through the provider named by MAIL_PROVIDER (smtp, resend or console; see .env.example).
 * Never throws: a failure is logged and returned, so a mail outage cannot break sign-up or password reset.
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const r = await deliver(msg);
  if (!r.ok) console.error(`[mailer] email to ${msg.to} not sent: ${r.error}`);
  return r;
}

let warned = false;
/** Public base URL used in links inside emails. */
export function appUrl() {
  if (!process.env.APP_URL && process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.error("[mailer] APP_URL is not set: links in emails will point to http://localhost:3000.");
  }
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
