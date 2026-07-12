-- CreateTable
CREATE TABLE "swarmsy_identity_ideas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspace_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "approved_at" DATETIME,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "swarmsy_identity_ideas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "swarmsy_identity_ideas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "swarmsy_identity_ideas_workspace_id_user_id_deleted_at_idx"
ON "swarmsy_identity_ideas"("workspace_id", "user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "swarmsy_identity_ideas_workspace_id_user_id_status_idx"
ON "swarmsy_identity_ideas"("workspace_id", "user_id", "status");
