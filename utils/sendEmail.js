// utils/sendEmail.js — Send email via Gmail SMTP using nodemailer
const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"TESCO HRM" <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('[EMAIL] Sent to:', to, '| Message ID:', info.messageId);
  return info;
};

module.exports = sendEmail;
