-- AlterTable
ALTER TABLE "swarmsy_identity_ideas" ADD COLUMN "proposal_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "swarmsy_identity_ideas_workspace_id_user_id_proposal_key_key"
ON "swarmsy_identity_ideas"("workspace_id", "user_id", "proposal_key");
