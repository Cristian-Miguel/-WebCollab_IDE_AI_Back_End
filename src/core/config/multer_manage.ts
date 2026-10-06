import multer from 'multer';
import { Request } from 'express';
import * as path from 'path';

// Directorio donde se guardarán temporalmente los archivos subidos.
// Se usa un path relativo al directorio raíz del proyecto.
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'profile_images');

/**
 * Configuración de almacenamiento en disco para Multer.
 * Define la ubicación y cómo nombrar los archivos.
 */
const storage = multer.diskStorage({
    destination: (
        req: Request,
        file: Express.Multer.File,
        callback: (error: Error | null, destination: string) => void
    ): void => {
        // En un proyecto real, se debe asegurar que el directorio exista (fs.mkdirSync).
        callback(null, UPLOAD_DIR);
    },

    filename: (
        req: Request,
        file: Express.Multer.File,
        callback: (error: Error | null, filename: string) => void
    ): void => {
        // Genera un nombre de archivo único para evitar colisiones.
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        // Concatenar el sufijo único con la extensión original.
        callback(null, `profile-${uniqueSuffix}${fileExtension}`);
    }
});

/**
 * Filtro de archivos para aceptar solo formatos de imagen comunes.
 * Se utiliza para validar que el archivo sea una imagen de perfil.
 */
const fileFilter = (
    req: Request,
    file: Express.Multer.File,
    callback: multer.FileFilterCallback
): void => {
    // Comprueba el mimetype del archivo.
    if (file.mimetype.startsWith('image/')) {
        callback(null, true); // Aceptar el archivo
    } else {
        // Rechazar el archivo con un error que será capturado por el middleware de Multer.
        // Podrías lanzar una excepción personalizada aquí para un manejo más fino.
        callback(new Error('Invalid file type. Only image files are allowed for profile pictures.') as any, false);
    }
};

/**
 * Instancia de Multer configurada.
 * - storage: Utiliza la configuración de almacenamiento en disco.
 * - limits: Establece un límite de tamaño (ej. 5MB).
 * - fileFilter: Aplica el filtro de tipos de archivo.
 */
export const uploadMiddleware = 
    multer({
        storage: storage,
        limits: {
            fileSize: 1024 * 1024 * 5,
        },
        fileFilter: fileFilter,
    });

/**
 * Exporta una función de middleware lista para usar en rutas que esperan una sola imagen.
 * Se debe llamar en las rutas de registro y modificación de usuario[cite: 112, 147].
 * @param fieldName El nombre del campo del formulario que contiene el archivo (ej. 'profile_image').
 */
export const uploadSingleImage = (fieldName: string) => {
    uploadMiddleware.single(fieldName);
    return UPLOAD_DIR.concat('/').concat(fieldName);
};