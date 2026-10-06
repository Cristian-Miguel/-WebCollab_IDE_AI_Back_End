// src/core/config/email_templates/validation_email_template.ts

/**
 * Genera la plantilla HTML estilizada para la validación de cuenta.
 * @param userName Nombre o correo del usuario para personalizar el saludo.
 * @param validationLink URL completa que contiene el token de validación.
 * @returns Cadena HTML del correo electrónico.
 */
export const validationEmailTemplate = (userName: string, validationLink: string): string => {
    
    // Estilos generales (colores base de tu tema MUI)
    const primaryColor = '#4CAF50';
    const secondaryColor = '#757575';
    const backgroundColor = '#F4F4F4';

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Activa tu Cuenta</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: ${backgroundColor}; margin: 0; padding: 0;">

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%;">
                <tr>
                    <td align="center" style="padding: 20px 10px;">
                        
                        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            
                            <tr>
                                <td align="center" style="padding: 20px 0; background-color: ${primaryColor}; border-top-left-radius: 8px; border-top-right-radius: 8px;">
                                    <h1 style="color: white; margin: 0;">¡Bienvenido a Tu Aplicación!</h1>
                                    <p style="color: #ffffffd0; margin: 0; font-size: 14px;">Activa tu cuenta para comenzar</p>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 40px 30px;">
                                    <h2 style="color: #333; margin-top: 0;">Hola, ${userName}</h2>
                                    
                                    <p style="color: #555; line-height: 1.5;">
                                        Gracias por registrarte. Para completar la creación de tu cuenta y verificar que este correo te pertenece, por favor haz clic en el botón de activación.
                                    </p>
                                    
                                    <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px; margin-bottom: 30px;">
                                        <tr>
                                            <td align="center">
                                                <a href="${validationLink}" target="_blank" style="
                                                    display: inline-block; 
                                                    padding: 12px 25px; 
                                                    background-color: ${primaryColor}; 
                                                    color: white; 
                                                    text-decoration: none; 
                                                    border-radius: 5px; 
                                                    font-weight: bold;
                                                    border: 1px solid ${primaryColor};
                                                ">
                                                    Activar Mi Cuenta
                                                </a>
                                            </td>
                                        </tr>
                                    </table>

                                    <p style="color: #555; line-height: 1.5;">
                                        Este enlace de validación tiene una duración de **15 días**. Si tienes problemas para hacer clic, copia y pega el siguiente enlace en tu navegador:
                                    </p>
                                    <p style="word-break: break-all; font-size: 12px; color: ${secondaryColor};">
                                        ${validationLink}
                                    </p>
                                </td>
                            </tr>

                            <tr>
                                <td align="center" style="padding: 20px 30px; background-color: ${backgroundColor}; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                                    <p style="margin: 0; font-size: 12px; color: ${secondaryColor};">
                                        &copy; ${new Date().getFullYear()} Tu Aplicación. Todos los derechos reservados.
                                    </p>
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
};