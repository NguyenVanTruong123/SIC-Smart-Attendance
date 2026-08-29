ALTER TABLE "class_sessions"
  ADD COLUMN "period_start" INTEGER,
  ADD COLUMN "period_end" INTEGER;

ALTER TABLE "class_sessions"
  ADD CONSTRAINT "class_sessions_period_range_check"
  CHECK (
    ("period_start" IS NULL AND "period_end" IS NULL)
    OR (
      "period_start" BETWEEN 1 AND 13
      AND "period_end" BETWEEN 1 AND 13
      AND "period_end" >= "period_start"
    )
  );

CREATE INDEX "class_sessions_session_date_classroom_id_idx"
  ON "class_sessions"("session_date", "classroom_id");

CREATE INDEX "class_sessions_course_class_id_session_date_idx"
  ON "class_sessions"("course_class_id", "session_date");

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "class_sessions"
  ADD CONSTRAINT "class_sessions_room_time_no_overlap"
  EXCLUDE USING gist (
    "classroom_id" WITH =,
    tsrange(
      ("session_date" + "start_time"),
      ("session_date" + "end_time"),
      '[)'
    ) WITH &&
  )
  WHERE ("status" <> 'CANCELLED'::"SessionStatus");

ALTER TABLE "class_sessions"
  ADD CONSTRAINT "class_sessions_course_time_no_overlap"
  EXCLUDE USING gist (
    "course_class_id" WITH =,
    tsrange(
      ("session_date" + "start_time"),
      ("session_date" + "end_time"),
      '[)'
    ) WITH &&
  )
  WHERE ("status" <> 'CANCELLED'::"SessionStatus");
