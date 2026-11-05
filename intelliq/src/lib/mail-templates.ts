// Bilingual (English / Mongolian) transactional emails. Pure functions: every value that reaches the HTML is escaped.
export type MailLang = "en" | "mn";
export type Mail = { subject: string; text: string; html: string };

export const mailLang = (requested?: string | null, saved?: string | null): MailLang => (requested === "mn" || requested === "en" ? requested : saved === "mn" ? "mn" : "en");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Copy = { subject: string; hello: (name: string) => string; lines: string[]; button: string; fallback: string; ignore: string; footer: string };

function render(lang: MailLang, c: Copy, name: string, url: string): Mail {
  const text = [c.hello(name), "", ...c.lines, "", `${c.button}: ${url}`, "", c.ignore, "", `— INTELLIQ`, c.footer].join("\n");
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:24px;background:#f4f5fb;font-family:Arial,Helvetica,sans-serif;color:#1b1f33;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px;">
<tr><td>
<p style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#4a2fd0;">INTELLIQ</p>
<p style="margin:0 0 16px;font-size:16px;">${esc(c.hello(name))}</p>
${c.lines.map((l) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${esc(l)}</p>`).join("\n")}
<p style="margin:24px 0;"><a href="${esc(url)}" style="display:inline-block;background:#4a2fd0;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">${esc(c.button)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#555b75;">${esc(c.fallback)}</p>
<p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${esc(url)}" style="color:#4a2fd0;">${esc(url)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#555b75;">${esc(c.ignore)}</p>
<p style="margin:16px 0 0;font-size:12px;color:#767b92;">${esc(c.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: c.subject, text, html };
}

const COPY: Record<MailLang, { verify: Copy; reset: (minutes: number) => Copy }> = {
  en: {
    verify: {
      subject: "Verify your INTELLIQ email",
      hello: (n) => `Hi ${n},`,
      lines: ["Thanks for creating an INTELLIQ account. Please confirm that this is your email address."],
      button: "Verify my email",
      fallback: "If the button does not work, copy this link into your browser:",
      ignore: "If you did not create an account, you can ignore this message.",
      footer: "INTELLIQ is a practice tool and does not provide an official IQ score.",
    },
    reset: (m) => ({
      subject: "Reset your INTELLIQ password",
      hello: (n) => `Hi ${n},`,
      lines: [`We received a request to reset your password. The link below works for ${m} minutes and can be used once.`],
      button: "Choose a new password",
      fallback: "If the button does not work, copy this link into your browser:",
      ignore: "If you did not ask for this, ignore this message: your password stays the same.",
      footer: "INTELLIQ is a practice tool and does not provide an official IQ score.",
    }),
  },
  mn: {
    verify: {
      subject: "INTELLIQ: имэйл хаягаа баталгаажуулна уу",
      hello: (n) => `Сайн байна уу, ${n}!`,
      lines: ["INTELLIQ-д бүртгүүлсэнд баярлалаа. Энэ имэйл хаяг таных мөн эсэхийг баталгаажуулна уу."],
      button: "Имэйлээ баталгаажуулах",
      fallback: "Товч ажиллахгүй бол энэ холбоосыг хөтөч рүүгээ хуулна уу:",
      ignore: "Хэрэв та бүртгүүлээгүй бол энэ захидлыг үл тоомсорлоно уу.",
      footer: "INTELLIQ нь дадлага хийх хэрэгсэл бөгөөд албан ёсны IQ оноо өгдөггүй.",
    },
    reset: (m) => ({
      subject: "INTELLIQ: нууц үгээ сэргээх",
      hello: (n) => `Сайн байна уу, ${n}!`,
      lines: [`Таны нууц үгийг шинэчлэх хүсэлт ирлээ. Доорх холбоос ${m} минутын дотор хүчинтэй бөгөөд нэг удаа ашиглагдана.`],
      button: "Шинэ нууц үг сонгох",
      fallback: "Товч ажиллахгүй бол энэ холбоосыг хөтөч рүүгээ хуулна уу:",
      ignore: "Хэрэв та хүсэлт илгээгээгүй бол энэ захидлыг үл тоомсорлоно уу: нууц үг тань өөрчлөгдөхгүй.",
      footer: "INTELLIQ нь дадлага хийх хэрэгсэл бөгөөд албан ёсны IQ оноо өгдөггүй.",
    }),
  },
};

export const verificationMail = (lang: MailLang, v: { name: string; url: string }): Mail => render(lang, COPY[lang].verify, v.name, v.url);
export const resetMail = (lang: MailLang, v: { name: string; url: string; validMinutes: number }): Mail => render(lang, COPY[lang].reset(v.validMinutes), v.name, v.url);
