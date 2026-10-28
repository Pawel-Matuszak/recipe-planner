-- AlterTable
ALTER TABLE "recipe" ADD COLUMN     "client_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "recipe_client_id_key" ON "recipe"("client_id");

