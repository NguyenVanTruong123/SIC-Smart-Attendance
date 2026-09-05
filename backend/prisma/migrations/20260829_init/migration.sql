-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "CourseClassStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'LIVE_NOW', 'REVIEW', 'DEGRADED', 'FAILED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('UNCONFIRMED', 'PRESENT', 'LATE', 'ABSENT', 'TRUANT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "LeaveRequestType" AS ENUM ('FULL_SESSION', 'LATE_ENTRY');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('ADMIN_DATA_CHANGE', 'MANUAL_OVERRIDE', 'EKYC_APPROVED', 'EKYC_RESET', 'SESSION_STARTED', 'SESSION_ENDED', 'INTRUDER_ALERT', 'CAMERA_CONFIG_CHANGE');

-- CreateEnum
CREATE TYPE "FaceDetectionResult" AS ENUM ('MATCHED', 'UNKNOWN_PERSON', 'AMBIGUOUS');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "user_code" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "role" "UserRole" NOT NULL,
    "department" VARCHAR(150),
    "department_id" UUID,
    "class_name" VARCHAR(50),
    "phone" VARCHAR(20),
    "avatar_url" VARCHAR(500),
    "is_face_enrolled" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classrooms" (
    "id" UUID NOT NULL,
    "room_code" VARCHAR(50) NOT NULL,
    "building" VARCHAR(50) NOT NULL,
    "floor" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "camera_ip" VARCHAR(50) NOT NULL,
    "rtsp_url" VARCHAR(500) NOT NULL,
    "camera_status" "CameraStatus" NOT NULL DEFAULT 'ONLINE',
    "fps" INTEGER NOT NULL DEFAULT 30,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "course_code" VARCHAR(50) NOT NULL,
    "course_name" VARCHAR(200) NOT NULL,
    "credits" INTEGER NOT NULL,
    "total_sessions" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_classes" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "class_code" VARCHAR(100) NOT NULL,
    "semester" VARCHAR(20) NOT NULL,
    "academic_year" VARCHAR(30) NOT NULL,
    "status" "CourseClassStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" UUID NOT NULL,
    "course_class_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "total_absences" INTEGER NOT NULL DEFAULT 0,
    "absence_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "is_banned_from_exam" BOOLEAN NOT NULL DEFAULT false,
    "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" UUID NOT NULL,
    "course_class_id" UUID NOT NULL,
    "classroom_id" UUID NOT NULL,
    "session_number" INTEGER NOT NULL,
    "session_date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "topic" VARCHAR(255),
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "roster_version" VARCHAR(100),
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_logs" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMPTZ,
    "best_score" DECIMAL(5,4),
    "best_evidence_id" UUID,
    "checkpoints" JSONB DEFAULT '{"15m": false, "30m": false, "45m": false, "60m": false}',
    "is_guest_student" BOOLEAN NOT NULL DEFAULT false,
    "manual_override_by" UUID,
    "override_reason" TEXT,
    "override_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_proof_snapshots" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "milestone_minutes" INTEGER NOT NULL,
    "snapshot_time" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "image_url" VARCHAR(500) NOT NULL,
    "ai_match_score" DECIMAL(5,2),
    "bounding_box" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_proof_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_face_detections" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID,
    "result" "FaceDetectionResult" NOT NULL,
    "frame_id" VARCHAR(100) NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "score" DECIMAL(5,4),
    "runner_up_score" DECIMAL(5,4),
    "quality" DECIMAL(5,4),
    "pose" VARCHAR(20),
    "bounding_box" JSONB,
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_face_detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "request_type" "LeaveRequestType" NOT NULL DEFAULT 'FULL_SESSION',
    "reason" TEXT NOT NULL,
    "attachment_url" VARCHAR(500),
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" UUID,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_biometrics" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "faiss_vector_id" BIGINT,
    "enrolled_face_url" VARCHAR(500),
    "last_enrolled_at" TIMESTAMPTZ,
    "model_version" VARCHAR(100),
    "embedding_dimension" INTEGER,
    "enrollment_version" INTEGER NOT NULL DEFAULT 1,
    "match_confidence" DECIMAL(5,2),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_biometrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_update_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_code" VARCHAR(50) NOT NULL,
    "identity_card_url" VARCHAR(500) NOT NULL,
    "new_face_video_url" VARCHAR(500) NOT NULL,
    "new_face_image_url" VARCHAR(500),
    "reason" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" UUID,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biometric_update_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action_type" "AuditActionType" NOT NULL,
    "target_table" VARCHAR(50),
    "target_id" UUID,
    "before_state" JSONB,
    "after_state" JSONB,
    "description" TEXT,
    "cctv_snapshot_url" VARCHAR(500),
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_user_code_key" ON "users"("user_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_room_code_key" ON "classrooms"("room_code");

-- CreateIndex
CREATE UNIQUE INDEX "courses_course_code_key" ON "courses"("course_code");

-- CreateIndex
CREATE UNIQUE INDEX "course_classes_class_code_key" ON "course_classes"("class_code");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_course_class_id_student_id_key" ON "course_enrollments"("course_class_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_logs_session_id_student_id_key" ON "attendance_logs"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "session_face_detections_session_id_result_idx" ON "session_face_detections"("session_id", "result");

-- CreateIndex
CREATE UNIQUE INDEX "user_biometrics_user_id_key" ON "user_biometrics"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_biometrics_faiss_vector_id_key" ON "user_biometrics"("faiss_vector_id");

-- CreateIndex
CREATE UNIQUE INDEX "biometric_update_requests_request_code_key" ON "biometric_update_requests"("request_code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_class_id_fkey" FOREIGN KEY ("course_class_id") REFERENCES "course_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_course_class_id_fkey" FOREIGN KEY ("course_class_id") REFERENCES "course_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_manual_override_by_fkey" FOREIGN KEY ("manual_override_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_proof_snapshots" ADD CONSTRAINT "session_proof_snapshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_proof_snapshots" ADD CONSTRAINT "session_proof_snapshots_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_face_detections" ADD CONSTRAINT "session_face_detections_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_face_detections" ADD CONSTRAINT "session_face_detections_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_biometrics" ADD CONSTRAINT "user_biometrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_update_requests" ADD CONSTRAINT "biometric_update_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_update_requests" ADD CONSTRAINT "biometric_update_requests_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
