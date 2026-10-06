/**
 * Genera la plantilla HTML estilizada para la notificación de cambio de contraseña exitoso.
 * @param userName Nombre o correo del usuario para personalizar el saludo.
 * @param loginUrl URL de la página de inicio de sesión (ej. /login).
 * @returns Cadena HTML del correo electrónico.
 */
export const passwordChangedTemplate = (userName: string, loginUrl: string): string => {
    
    // Estilos generales (colores base de tu tema MUI)
    const primaryColor = '#4CAF50'; // Color de éxito/validación (verde)
    const secondaryColor = '#757575'; // Color de texto secundario
    const backgroundColor = '#F4F4F4'; // Fondo del correo
    const alertColor = '#FBC02D'; // Advertencia (Amarillo/Naranja)

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contraseña Actualizada</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: ${backgroundColor}; margin: 0; padding: 0;">

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%;">
                <tr>
                    <td align="center" style="padding: 20px 10px;">
                        
                        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            
                            <tr>
                                <td align="center" style="padding: 20px 0; background-color: ${primaryColor}; border-top-left-radius: 8px; border-top-right-radius: 8px;">
                                    <h1 style="color: white; margin: 0;">¡Contraseña Actualizada!</h1>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 40px 30px;">
                                    <h2 style="color: #333; margin-top: 0;">Hola, ${userName}</h2>
                                    
                                    <p style="color: #555; line-height: 1.5;">
                                        Te confirmamos que la contraseña de tu cuenta ha sido cambiada con éxito.
                                        Tu acceso ya está disponible con la nueva contraseña.
                                    </p>
                                    
                                    <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 20px; border: 1px solid ${alertColor}; background-color: #FFFDE7; padding: 10px; border-radius: 4px;">
                                        <tr>
                                            <td style="padding: 10px;">
                                                <p style="color: #333; margin: 0; font-weight: bold;">Medida de Seguridad:</p>
                                                <p style="color: #555; margin: 5px 0 0; font-size: 13px;">
                                                    Si tú no realizaste este cambio, por favor contáctanos inmediatamente.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>

                                    <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px; margin-bottom: 30px;">
                                        <tr>
                                            <td align="center">
                                                <a href="${loginUrl}" target="_blank" style="
                                                    display: inline-block; 
                                                    padding: 12px 25px; 
                                                    background-color: ${primaryColor}; 
                                                    color: white; 
                                                    text-decoration: none; 
                                                    border-radius: 5px; 
                                                    font-weight: bold;
                                                    border: 1px solid ${primaryColor};
                                                ">
                                                    Ir a Iniciar Sesión
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
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