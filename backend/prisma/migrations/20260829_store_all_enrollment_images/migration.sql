-- CreateTable
CREATE TABLE "user_enrollment_images" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "image_index" INTEGER NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "pose" VARCHAR(20),
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_enrollment_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_enrollment_images_user_id_image_index_key"
  ON "user_enrollment_images"("user_id", "image_index");

-- CreateIndex
CREATE INDEX "user_enrollment_images_user_id_idx"
  ON "user_enrollment_images"("user_id");

-- AddForeignKey
ALTER TABLE "user_enrollment_images"
  ADD CONSTRAINT "user_enrollment_images_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
