const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

router.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `Nuevo mensaje de RiegAR: ${name}`,
    html: `
      <h3>Tienes un nuevo mensaje de contacto</h3>
      <p><strong>Nombre:</strong> ${name}</p>
      <p><strong>Email del usuario:</strong> ${email}</p>
      <p><strong>Mensaje:</strong></p>
      <blockquote style="background: #f9f9f9; padding: 10px; border-left: 5px solid #ccc;">
        ${message}
      </blockquote>
    `,
    replyTo: email,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Correo enviado con éxito." });
  } catch (error) {
    console.error("Error enviando correo:", error);
    res.status(500).json({ error: "No se pudo enviar el correo." });
  }
});

module.exports = router;
