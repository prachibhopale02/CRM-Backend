const nodemailer = require("nodemailer");

// ================= GMAIL TRANSPORT =================
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.EMAIL_USER,       // your gmail id
    pass: process.env.EMAIL_PASS,       // APP PASSWORD (not normal password)
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 10000,
  socketTimeout: 20000,
});

// ================= SEND EMAIL =================
const sendEmail = async (
  from,
  to,
  subject,
  html,
  cc = [],
  attachments = []
) => {
  try {
    const ccList = Array.isArray(cc)
      ? cc.filter(Boolean)
      : [cc].filter(Boolean);

    const attachmentList = Array.isArray(attachments)
      ? attachments
      : [];

    await transporter.sendMail({
      from: from || process.env.EMAIL_USER,
      to,
      cc: ccList,
      subject,
      html,
      attachments: attachmentList,
    });

    return true;
  } catch (err) {
    console.error("❌ EMAIL ERROR:", err.message);
    throw err;
  }
};

module.exports = sendEmail;