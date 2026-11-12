import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";

function readEnv(name: string) {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return processEnv?.[name];
}

function otpEmailProvider(id: string, subject: string) {
  return Email({
    id,
    maxAge: 10 * 60,
    generateVerificationToken: async () => {
      return String(Math.floor(100000 + Math.random() * 900000));
    },
    sendVerificationRequest: async ({ identifier, token }) => {
      const resendKey = readEnv("AUTH_RESEND_KEY");
      const fromEmail =
        readEnv("AUTH_EMAIL_FROM") ??
        "Smart Motor Starter <onboarding@resend.dev>";
      const toEmail = identifier.trim().toLowerCase();

      if (!resendKey) {
        throw new Error("AUTH_RESEND_KEY is not configured");
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          text: `Your OTP is ${token}. It expires in 10 minutes.`,
          html: `<p>Your OTP is <strong>${token}</strong>.</p><p>It expires in 10 minutes.</p>`,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Failed to send OTP email: ${body}`);
      }
    },
  });
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile: (params) => {
        const email = String(params.email ?? "").trim().toLowerCase();
        const name =
          typeof params.name === "string" ? params.name.trim() : undefined;
        const phone =
          typeof params.phone === "string" ? params.phone.trim() : undefined;

        return {
          email,
          ...(name ? { name } : {}),
          ...(phone ? { phone } : {}),
        };
      },
      verify: otpEmailProvider("email-verify", "Your Smart Motor Starter OTP"),
      reset: otpEmailProvider("email-reset", "Your Smart Motor Starter password reset OTP"),
    }),
  ],
});
