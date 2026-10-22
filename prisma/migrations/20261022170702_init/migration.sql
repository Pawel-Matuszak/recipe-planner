-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,
    "ban_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "impersonated_by" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_member" (
    "household_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "member_role" NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_member_pkey" PRIMARY KEY ("household_id","user_id")
);

-- CreateTable
CREATE TABLE "household_invite" (
    "code" TEXT NOT NULL,
    "household_id" UUID NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_invite_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "department" (
    "id" SMALLSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "name_norm" TEXT NOT NULL,
    "department_id" SMALLINT NOT NULL,

    CONSTRAINT "ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_type" (
    "id" SMALLSERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "recipe_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" SMALLSERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe" (
    "id" SERIAL NOT NULL,
    "legacy_id" TEXT,
    "name" TEXT NOT NULL,
    "type_id" SMALLINT NOT NULL,
    "difficulty" "difficulty",
    "time_min" INTEGER,
    "description" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "ingredients_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_category" (
    "recipe_id" INTEGER NOT NULL,
    "category_id" SMALLINT NOT NULL,

    CONSTRAINT "recipe_category_pkey" PRIMARY KEY ("recipe_id","category_id")
);

-- CreateTable
CREATE TABLE "recipe_link" (
    "recipe_id" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "recipe_link_pkey" PRIMARY KEY ("recipe_id","position")
);

-- CreateTable
CREATE TABLE "recipe_step" (
    "recipe_id" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "recipe_step_pkey" PRIMARY KEY ("recipe_id","position")
);

-- CreateTable
CREATE TABLE "recipe_ingredient" (
    "recipe_id" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "qty_text" TEXT,

    CONSTRAINT "recipe_ingredient_pkey" PRIMARY KEY ("recipe_id","position")
);

-- CreateTable
CREATE TABLE "household_recipe_state" (
    "household_id" UUID NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "rating" SMALLINT,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "household_recipe_state_pkey" PRIMARY KEY ("household_id","recipe_id")
);

-- CreateTable
CREATE TABLE "pantry_item" (
    "household_id" UUID NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "have" BOOLEAN NOT NULL DEFAULT false,
    "always" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pantry_item_pkey" PRIMARY KEY ("household_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "plan_entry" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "recipe_id" INTEGER,
    "text" TEXT,
    "meal" TEXT NOT NULL DEFAULT '',
    "planned_on" DATE,
    "cooked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_extra" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "item" TEXT NOT NULL,
    "bought" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_extra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "household_member_user_id_idx" ON "household_member"("user_id");

-- CreateIndex
CREATE INDEX "household_invite_household_id_idx" ON "household_invite"("household_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_name_key" ON "department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_name_key" ON "ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_name_norm_key" ON "ingredient"("name_norm");

-- CreateIndex
CREATE INDEX "ingredient_department_id_idx" ON "ingredient"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_type_name_key" ON "recipe_type"("name");

-- CreateIndex
CREATE UNIQUE INDEX "category_name_key" ON "category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_legacy_id_key" ON "recipe"("legacy_id");

-- CreateIndex
CREATE INDEX "recipe_type_id_idx" ON "recipe"("type_id");

-- CreateIndex
CREATE INDEX "recipe_category_category_id_idx" ON "recipe_category"("category_id");

-- CreateIndex
CREATE INDEX "recipe_ingredient_ingredient_id_idx" ON "recipe_ingredient"("ingredient_id");

-- CreateIndex
CREATE INDEX "household_recipe_state_recipe_id_idx" ON "household_recipe_state"("recipe_id");

-- CreateIndex
CREATE INDEX "pantry_item_ingredient_id_idx" ON "pantry_item"("ingredient_id");

-- CreateIndex
CREATE INDEX "plan_entry_household_id_idx" ON "plan_entry"("household_id");

-- CreateIndex
CREATE INDEX "plan_entry_recipe_id_idx" ON "plan_entry"("recipe_id");

-- CreateIndex
CREATE INDEX "shopping_extra_household_id_idx" ON "shopping_extra"("household_id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_member" ADD CONSTRAINT "household_member_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_member" ADD CONSTRAINT "household_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invite" ADD CONSTRAINT "household_invite_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invite" ADD CONSTRAINT "household_invite_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient" ADD CONSTRAINT "ingredient_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "recipe_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_category" ADD CONSTRAINT "recipe_category_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_category" ADD CONSTRAINT "recipe_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_link" ADD CONSTRAINT "recipe_link_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_step" ADD CONSTRAINT "recipe_step_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_recipe_state" ADD CONSTRAINT "household_recipe_state_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_recipe_state" ADD CONSTRAINT "household_recipe_state_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entry" ADD CONSTRAINT "plan_entry_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entry" ADD CONSTRAINT "plan_entry_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_extra" ADD CONSTRAINT "shopping_extra_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rules Prisma can't express in the schema
ALTER TABLE "household_recipe_state" ADD CONSTRAINT "household_recipe_state_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "plan_entry" ADD CONSTRAINT "plan_entry_recipe_or_text_check" CHECK ("recipe_id" IS NOT NULL OR NULLIF(btrim("text"), '') IS NOT NULL);
ALTER TABLE "ingredient" ADD CONSTRAINT "ingredient_name_norm_check" CHECK ("name_norm" = lower(btrim("name")));
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_time_min_check" CHECK ("time_min" > 0);
