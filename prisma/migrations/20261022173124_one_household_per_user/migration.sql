-- DropIndex
DROP INDEX "household_member_user_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "household_member_user_id_key" ON "household_member"("user_id");

