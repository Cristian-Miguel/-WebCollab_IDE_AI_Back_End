// src/core/config/mail_sender.ts

import nodemailer, { SendMailOptions } from 'nodemailer';

// Define la interfaz para los datos de envío, simplificando su uso
interface MailData {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    // Opcional: permite anular el remitente predeterminado
    from?: string; 
}

// Configuración del Transporter de Nodemailer
// Utiliza las variables de entorno para la configuración SMTP
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: Number(process.env.EMAIL_PORT) === 465, // true para puerto 465 (SSL), false para 587/2525 (TLS)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Función genérica para enviar correos electrónicos.
 * Asume que el remitente (from) será la variable EMAIL_FROM del entorno, a menos que se anule.
 * @param data Objeto con los detalles del correo (to, subject, html, [text], [from]).
 */
export const sendEmail = async (data: MailData): Promise<void> => {
    // Definición de las opciones del correo
    const mailOptions: SendMailOptions = {
        from: data.from || process.env.EMAIL_FROM, // Remitente por defecto 
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
    };

    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn('[MAIL_SENDER] Credenciales de correo no configuradas. Simulando envío...');
            // En entorno de desarrollo, puedes simular el envío para evitar usar SMTP real.
            return;
        }

        // Envía el correo usando el transporter
        const info = await transporter.sendMail(mailOptions);
        
        // Aquí podrías usar tu LoggerManage (de winston) para un log de tipo 'info' 
        // sobre el envío exitoso.
        console.log(`[MAIL_SENDER] Email sent: ${info.messageId}`);
    } catch (error) {
        // En caso de error, es crucial loggear el stack completo, como se indica en tus requerimientos[cite: 107].
        // logger.error('Error sending email:', { 
        //     recipient: data.to, 
        //     error: error.message, 
        //     stack: error.stack 
        // });
        console.error('[MAIL_SENDER] Error sending email:', error);
        
        // Podrías lanzar una excepción personalizada (ej. MailException)
        throw new Error('Failed to send email');
    }
};