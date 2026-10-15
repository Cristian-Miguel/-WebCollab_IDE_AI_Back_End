import multer from 'multer';
import * as path from 'path';

// Directorio donde se guardarán temporalmente los archivos subidos.
// Se usa un path relativo al directorio raíz del proyecto.
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'profile_images');

/**
 * Configuración de almacenamiento en disco para Multer.
 * Define la ubicación y cómo nombrar los archivos.
 */
const storage = multer.diskStorage({
    destination: (_req, _file, callback): void => {
        callback(null, UPLOAD_DIR);
    },

    filename: (_req, file, callback): void => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        callback(null, `profile-${uniqueSuffix}${fileExtension}`);
    }
});

/**
 * Filtro de archivos para aceptar solo formatos de imagen comunes.
 * Se utiliza para validar que el archivo sea una imagen de perfil.
 */
const fileFilter: multer.Options['fileFilter'] = (_req, file, callback): void => {
    if (file.mimetype.startsWith('image/')) {
        callback(null, true);
    } else {
        callback(new Error('Invalid file type. Only image files are allowed for profile pictures.'));
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