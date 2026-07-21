-- CreateTable role_permission
CREATE TABLE IF NOT EXISTS app."role_permission" (
    id TEXT NOT NULL PRIMARY KEY,
    role TEXT NOT NULL UNIQUE,
    permissions TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    description TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    CONSTRAINT "role_permission_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES app."Account"(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "role_permission_role_key" ON app."role_permission"("role");
