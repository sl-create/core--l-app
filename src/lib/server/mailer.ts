import "server-only";

export type Email = { to: string; subject: string; text: string };

/** True when a real email provider is configured. Otherwise emails are only logged. */
export const mailerConfigured = () => Boolean(process.env.RESEND_API_KEY);

export async function sendEmail(email: Email): Promise<void> {
  if (!mailerConfigured()) {
    console.log(`[email] to=${email.to} subject="${email.subject}"\n${email.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Ajo <hello@ajo.app>",
      to: email.to,
      subject: email.subject,
      text: email.text,
    }),
  });
  if (!res.ok) throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
}
