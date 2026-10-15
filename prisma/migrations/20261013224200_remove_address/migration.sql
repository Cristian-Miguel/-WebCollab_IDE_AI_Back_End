ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_address_id_fkey";
ALTER TABLE "users" DROP COLUMN IF EXISTS "address_id";
DROP TABLE IF EXISTS "addresses";
