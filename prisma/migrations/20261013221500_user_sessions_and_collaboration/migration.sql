ALTER TABLE "users" RENAME COLUMN "password" TO "password_hash";
ALTER TABLE "users" RENAME COLUMN "fullName" TO "nombre";
ALTER TABLE "users" RENAME COLUMN "login_attempts" TO "attempts_login";
ALTER TABLE "users" RENAME COLUMN "lock_until" TO "blocked_until";
ALTER TABLE "users" RENAME COLUMN "last_login" TO "last_login_at";
ALTER TABLE "users" RENAME COLUMN "last_logout" TO "last_logout_at";

ALTER TABLE "Role" ALTER COLUMN "is_active" SET DEFAULT true;

CREATE TYPE "RolParticipante" AS ENUM ('PROPIETARIO', 'COLABORADOR');
CREATE TYPE "EstadoSesion" AS ENUM ('ACTIVA', 'ARCHIVADA', 'CERRADA');

CREATE TABLE "sesiones_usuario" (
    "id" VARCHAR(255) NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    CONSTRAINT "sesiones_usuario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sesiones_colaborativas" (
    "id" VARCHAR(255) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "propietario_id" VARCHAR(255) NOT NULL,
    "estado" "EstadoSesion" NOT NULL DEFAULT 'ACTIVA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sesiones_colaborativas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "participantes_sesion" (
    "id" VARCHAR(255) NOT NULL,
    "usuario_id" VARCHAR(255) NOT NULL,
    "sesion_id" VARCHAR(255) NOT NULL,
    "rol" "RolParticipante" NOT NULL DEFAULT 'COLABORADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "participantes_sesion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "archivos_proyecto" (
    "id" VARCHAR(255) NOT NULL,
    "sesion_id" VARCHAR(255) NOT NULL,
    "html" TEXT NOT NULL DEFAULT '',
    "css" TEXT NOT NULL DEFAULT '',
    "javascript" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "archivos_proyecto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "historial_cambios" (
    "id" VARCHAR(255) NOT NULL,
    "usuario_id" VARCHAR(255) NOT NULL,
    "sesion_id" VARCHAR(255) NOT NULL,
    "detalle_cambio" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historial_cambios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mensajes_chat" (
    "id" VARCHAR(255) NOT NULL,
    "usuario_id" VARCHAR(255) NOT NULL,
    "sesion_id" VARCHAR(255) NOT NULL,
    "contenido" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mensajes_chat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sugerencias_ia" (
    "id" VARCHAR(255) NOT NULL,
    "sesion_id" VARCHAR(255) NOT NULL,
    "usuario_id" VARCHAR(255) NOT NULL,
    "prompt" TEXT NOT NULL,
    "respuesta" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sugerencias_ia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sesiones_usuario_refresh_token_hash_key" ON "sesiones_usuario"("refresh_token_hash");
CREATE INDEX "sesiones_usuario_user_id_is_valid_idx" ON "sesiones_usuario"("user_id", "is_valid");
CREATE INDEX "sesiones_usuario_expires_at_is_valid_updated_at_idx" ON "sesiones_usuario"("expires_at", "is_valid", "updated_at");
CREATE INDEX "users_is_deleted_email_idx" ON "users"("is_deleted", "email");
CREATE INDEX "users_is_account_locked_blocked_until_idx" ON "users"("is_account_locked", "blocked_until");
CREATE INDEX "sesiones_colaborativas_propietario_id_estado_idx" ON "sesiones_colaborativas"("propietario_id", "estado");
CREATE UNIQUE INDEX "participantes_sesion_usuario_id_sesion_id_key" ON "participantes_sesion"("usuario_id", "sesion_id");
CREATE UNIQUE INDEX "archivos_proyecto_sesion_id_key" ON "archivos_proyecto"("sesion_id");
CREATE INDEX "historial_cambios_sesion_id_created_at_idx" ON "historial_cambios"("sesion_id", "created_at");
CREATE INDEX "mensajes_chat_sesion_id_created_at_idx" ON "mensajes_chat"("sesion_id", "created_at");
CREATE INDEX "sugerencias_ia_sesion_id_created_at_idx" ON "sugerencias_ia"("sesion_id", "created_at");

ALTER TABLE "sesiones_usuario" ADD CONSTRAINT "sesiones_usuario_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sesiones_colaborativas" ADD CONSTRAINT "sesiones_colaborativas_propietario_id_fkey"
    FOREIGN KEY ("propietario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participantes_sesion" ADD CONSTRAINT "participantes_sesion_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participantes_sesion" ADD CONSTRAINT "participantes_sesion_sesion_id_fkey"
    FOREIGN KEY ("sesion_id") REFERENCES "sesiones_colaborativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "archivos_proyecto" ADD CONSTRAINT "archivos_proyecto_sesion_id_fkey"
    FOREIGN KEY ("sesion_id") REFERENCES "sesiones_colaborativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historial_cambios" ADD CONSTRAINT "historial_cambios_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historial_cambios" ADD CONSTRAINT "historial_cambios_sesion_id_fkey"
    FOREIGN KEY ("sesion_id") REFERENCES "sesiones_colaborativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mensajes_chat" ADD CONSTRAINT "mensajes_chat_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mensajes_chat" ADD CONSTRAINT "mensajes_chat_sesion_id_fkey"
    FOREIGN KEY ("sesion_id") REFERENCES "sesiones_colaborativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sugerencias_ia" ADD CONSTRAINT "sugerencias_ia_sesion_id_fkey"
    FOREIGN KEY ("sesion_id") REFERENCES "sesiones_colaborativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sugerencias_ia" ADD CONSTRAINT "sugerencias_ia_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
