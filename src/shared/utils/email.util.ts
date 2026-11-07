import nodemailer, { SendMailOptions, Transporter } from 'nodemailer';
import { LoggerManage } from '../../core/config/logger';

export interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
}

const PLACEHOLDER_VALUES = new Set([
    'smtp.example.com',
    'https://www.google.com/search?q=smtp.example.com',
    'your_email@example.com',
    'your_email_password',
]);

const isConfiguredCredential = (value?: string): boolean => {
    if (!value) return false;
    const trimmed = value.trim();
    return trimmed.length > 0 && !PLACEHOLDER_VALUES.has(trimmed);
};

/**
 * Crea y devuelve el transporter de Nodemailer configurado con las variables de entorno
 * (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) o con fallback a cuenta de prueba (Ethereal) / simulación.
 */
export const createEmailTransporter = async (): Promise<Transporter | null> => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (
        isConfiguredCredential(host) &&
        isConfiguredCredential(user) &&
        isConfiguredCredential(pass)
    ) {
        return nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user,
                pass,
            },
        });
    }

    // Plan de contingencia para desarrollo local: usar cuenta de prueba de Ethereal Email
    // o simular el envío en consola si no hay conexión externa o estamos en test.
    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
    if (nodeEnv !== 'test') {
        try {
            const testAccount = await nodemailer.createTestAccount();
            LoggerManage.info('Using Ethereal test account for local email delivery.', {
                user: testAccount.user,
            });
            return nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        } catch (error) {
            LoggerManage.warn('Could not create Ethereal test account. Falling back to console simulation.', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return null;
};

/**
 * Envía un correo electrónico utilizando el transportador configurado o simula su envío en consola.
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
    const fromAddress =
        options.from ||
        process.env.SMTP_FROM ||
        process.env.EMAIL_FROM ||
        '"CodeLive" <noreply@codelive.local>';

    const mailOptions: SendMailOptions = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
    };

    const transporter = await createEmailTransporter();

    if (!transporter) {
        console.log(
            `[EMAIL_SIMULATION] Simulando envío de correo -> Para: ${Array.isArray(options.to) ? options.to.join(', ') : options.to} | Asunto: "${options.subject}"`
        );
        LoggerManage.info('Simulated email delivery in console (no real SMTP credentials configured).', {
            to: options.to,
            subject: options.subject,
        });
        return;
    }

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    LoggerManage.info('Email sent successfully.', {
        messageId: info.messageId,
        to: options.to,
        ...(previewUrl ? { previewUrl } : {}),
    });

    if (previewUrl) {
        console.log(`[EMAIL_PREVIEW] Vista previa de Ethereal Email: ${previewUrl}`);
    }
};
