const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text) => {

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com", // Outlook SMTP
    port: 587,
    secure: false, // use STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // regular password or app password
    },
    tls: {
      ciphers: "SSLv3",
    },
  });

  await transporter.sendMail({
    from: `"Chemito CRM" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  });
};

module.exports = sendEmail;