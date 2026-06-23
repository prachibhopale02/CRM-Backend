
const nodemailer = require("nodemailer");

/**

 * @param {string} to - Recipient email
 * @param {string|number} otp - OTP code
 */
const sendOTPEmail = async (to, otp) => {
  // 🔹 Create transporter inside function to ensure env vars are loaded
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com", // Outlook SMTP
    port: 587,
    secure: false, // use STARTTLS
    auth: {
      user: process.env.EMAIL_USER, // Outlook email
      pass: process.env.EMAIL_PASS, // App password if MFA enabled
    },
    tls: {
      ciphers: "SSLv3",
    },
  });

  try {
    // 🔹 Send the OTP email
    await transporter.sendMail({
  from: `"CRM App" <${process.env.EMAIL_USER}>`,
  to,
  subject: "OTP for Password Change",
  text: `Your OTP is ${otp}. It will expire in 5 minutes.` // ✅ use text
});

    console.log(`✅ OTP sent successfully to ${to}`);
  } catch (err) {
    console.error("❌ Email sending failed:", err);
    throw err;
  }
};

module.exports = sendOTPEmail;