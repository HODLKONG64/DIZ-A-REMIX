-- CreateTable
CREATE TABLE "swarmsy_intake_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspace_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "answers" TEXT NOT NULL DEFAULT '{}',
    "completed_at" DATETIME,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "swarmsy_intake_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "swarmsy_intake_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "swarmsy_intake_sessions_workspace_id_user_id_version_key"
ON "swarmsy_intake_sessions"("workspace_id", "user_id", "version");

-- CreateIndex
CREATE INDEX "swarmsy_intake_sessions_workspace_id_user_id_is_active_idx"
ON "swarmsy_intake_sessions"("workspace_id", "user_id", "is_active");

-- CreateIndex
CREATE INDEX "swarmsy_intake_sessions_workspace_id_user_id_archived_at_idx"
ON "swarmsy_intake_sessions"("workspace_id", "user_id", "archived_at");

-- CreateIndex
CREATE INDEX "swarmsy_intake_sessions_workspace_id_user_id_updated_at_idx"
ON "swarmsy_intake_sessions"("workspace_id", "user_id", "updated_at");
