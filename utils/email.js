import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();
// ✅ Production: API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ Production: Verified domain
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@onligro.com";

export const sendEmail = async ({ to, subject, html }) => {
  try {

    const { data, error } = await resend.emails.send({
      from: `Onligro <${EMAIL_FROM}>`,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error(`❌ Resend error (${to}):`, error);
      return { success: false, error };
    }

   
    return { success: true, data };
  } catch (error) {
    console.error(`❌ Email error (${to}):`, error.message);
    return { success: false, error };
  }
};