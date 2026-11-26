-- Upgrade the production database from the schema on main (commit bc4a557) to this branch.
-- Generated with: prisma migrate diff --from-url $DIRECT_URL --to-schema-datamodel prisma/schema.prisma --script
--
-- REVIEW BEFORE RUNNING. Back up first (Neon: create a branch / restore point).
-- Destructive steps:
--   * DROP TABLE field_staff_schedules (old 6-day village schedules, replaced by field_tasks)
--   * DROP COLUMN attendance_policies.allow_unrestricted_field_checkin
--   * LocationRefType loses FIELD_SCHEDULE / UNRESTRICTED (existing records only use BRANCH)
-- Everything else only adds tables, columns and enum values.
--
-- Run once, then deploy the backend:  npx prisma db execute --file prisma/sql/upgrade-production-from-main.sql

-- CreateEnum
CREATE TYPE "FieldTaskStatus" AS ENUM ('PENDING', 'VISITED', 'COMPLETED', 'LATE_COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LateAccessStatus" AS ENUM ('NONE', 'REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StaffCategory" AS ENUM ('HEAD_OFFICE', 'REGIONAL_OFFICE', 'DISTRIBUTION_CENTER', 'MARKETING_EXECUTIVE', 'SALES_EXECUTIVE', 'PHARMACY', 'LABORATORY', 'LEADERSHIP');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('HEAD_OFFICE', 'REGIONAL_OFFICE', 'DISTRIBUTION_CENTER', 'PHARMACY_HUB', 'PHARMACY_SHOP', 'LABORATORY', 'OTHER');

-- CreateEnum
CREATE TYPE "GeofenceShape" AS ENUM ('CIRCLE', 'POLYGON');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmployeeStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "EmployeeStatus" ADD VALUE 'REJECTED';

-- AlterEnum
BEGIN;
CREATE TYPE "LocationRefType_new" AS ENUM ('BRANCH', 'FIELD_TASK', 'TERRITORY', 'CAMP', 'ANYWHERE');
ALTER TABLE "attendance_records" ALTER COLUMN "check_in_location_ref_type" TYPE "LocationRefType_new" USING ("check_in_location_ref_type"::text::"LocationRefType_new");
ALTER TABLE "attendance_records" ALTER COLUMN "check_out_location_ref_type" TYPE "LocationRefType_new" USING ("check_out_location_ref_type"::text::"LocationRefType_new");
ALTER TYPE "LocationRefType" RENAME TO "LocationRefType_old";
ALTER TYPE "LocationRefType_new" RENAME TO "LocationRefType";
DROP TYPE "LocationRefType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "field_staff_schedules" DROP CONSTRAINT "field_staff_schedules_assigned_by_fkey";

-- DropForeignKey
ALTER TABLE "field_staff_schedules" DROP CONSTRAINT "field_staff_schedules_employee_id_fkey";

-- AlterTable
ALTER TABLE "attendance_policies" DROP COLUMN "allow_unrestricted_field_checkin",
ADD COLUMN     "face_match_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "face_verification_required" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "late_access_hours" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "check_in_face_score" DOUBLE PRECISION,
ADD COLUMN     "check_in_is_mock_location" BOOLEAN,
ADD COLUMN     "check_in_selfie" TEXT,
ADD COLUMN     "check_out_face_score" DOUBLE PRECISION,
ADD COLUMN     "check_out_selfie" TEXT,
ADD COLUMN     "is_late" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shift_id" UUID,
ADD COLUMN     "shift_name" VARCHAR(100);

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "boundary" JSONB,
ADD COLUMN     "boundary_label" VARCHAR(255),
ADD COLUMN     "geofence_shape" "GeofenceShape" NOT NULL DEFAULT 'CIRCLE',
ADD COLUMN     "location_type" "LocationType" NOT NULL DEFAULT 'PHARMACY_SHOP',
ADD COLUMN     "territory" JSONB,
ADD COLUMN     "territory_label" VARCHAR(255);

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "approved_at" TIMESTAMPTZ,
ADD COLUMN     "approved_by" UUID,
ADD COLUMN     "date_of_joining" DATE,
ADD COLUMN     "designation" VARCHAR(120),
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "self_registered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shift_id" UUID,
ADD COLUMN     "staff_category" "StaffCategory";

-- DropTable
DROP TABLE "field_staff_schedules";

-- DropEnum
DROP TYPE "ScheduleType";

-- CreateTable
CREATE TABLE "field_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "task_date" DATE NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "location_name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radius_metres" INTEGER NOT NULL DEFAULT 100,
    "geofence_shape" "GeofenceShape" NOT NULL DEFAULT 'CIRCLE',
    "boundary" JSONB,
    "boundary_label" VARCHAR(255),
    "deadline_time" VARCHAR(5) NOT NULL,
    "status" "FieldTaskStatus" NOT NULL DEFAULT 'PENDING',
    "visited_at" TIMESTAMPTZ,
    "visit_lat" DECIMAL(10,7),
    "visit_lng" DECIMAL(10,7),
    "visit_accuracy_metres" DECIMAL(8,2),
    "visit_distance_metres" DECIMAL(10,2),
    "visit_face_score" DOUBLE PRECISION,
    "visit_selfie" TEXT,
    "visit_is_mock_location" BOOLEAN,
    "completion_note" TEXT,
    "survey_data" JSONB,
    "completed_at" TIMESTAMPTZ,
    "complete_lat" DECIMAL(10,7),
    "complete_lng" DECIMAL(10,7),
    "complete_distance_metres" DECIMAL(10,2),
    "late_access_status" "LateAccessStatus" NOT NULL DEFAULT 'NONE',
    "late_request_reason" TEXT,
    "late_requested_at" TIMESTAMPTZ,
    "late_reviewed_by" UUID,
    "late_reviewed_at" TIMESTAMPTZ,
    "late_review_note" TEXT,
    "late_access_until" TIMESTAMPTZ,
    "assigned_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "field_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "embeddings" JSONB NOT NULL,
    "photo" TEXT NOT NULL,
    "model_version" VARCHAR(50) NOT NULL,
    "consent_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "face_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "check_in_before_minutes" INTEGER NOT NULL DEFAULT 30,
    "late_grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "check_in_after_minutes" INTEGER NOT NULL DEFAULT 60,
    "check_out_before_minutes" INTEGER NOT NULL DEFAULT 15,
    "check_out_after_minutes" INTEGER NOT NULL DEFAULT 120,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "camp_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "location_name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radius_metres" INTEGER NOT NULL DEFAULT 200,
    "geofence_shape" "GeofenceShape" NOT NULL DEFAULT 'CIRCLE',
    "boundary" JSONB,
    "boundary_label" VARCHAR(255),
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "camps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "camp_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "check_in_at" TIMESTAMPTZ,
    "check_in_lat" DECIMAL(10,7),
    "check_in_lng" DECIMAL(10,7),
    "check_in_accuracy_metres" DECIMAL(8,2),
    "check_in_distance_metres" DECIMAL(10,2),
    "check_in_face_score" DOUBLE PRECISION,
    "check_in_selfie" TEXT,
    "check_in_is_mock_location" BOOLEAN,
    "check_out_at" TIMESTAMPTZ,
    "check_out_lat" DECIMAL(10,7),
    "check_out_lng" DECIMAL(10,7),
    "check_out_distance_metres" DECIMAL(10,2),
    "check_out_face_score" DOUBLE PRECISION,
    "report" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camp_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "customer_type" VARCHAR(60),
    "contact_person" VARCHAR(255),
    "mobile" VARCHAR(15),
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "added_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_tasks_employee_id_task_date_idx" ON "field_tasks"("employee_id", "task_date");

-- CreateIndex
CREATE INDEX "field_tasks_organization_id_task_date_idx" ON "field_tasks"("organization_id", "task_date");

-- CreateIndex
CREATE INDEX "field_tasks_organization_id_late_access_status_idx" ON "field_tasks"("organization_id", "late_access_status");

-- CreateIndex
CREATE UNIQUE INDEX "face_profiles_employee_id_key" ON "face_profiles"("employee_id");

-- CreateIndex
CREATE INDEX "shifts_organization_id_idx" ON "shifts"("organization_id");

-- CreateIndex
CREATE INDEX "camps_organization_id_camp_date_idx" ON "camps"("organization_id", "camp_date");

-- CreateIndex
CREATE INDEX "camp_assignments_employee_id_idx" ON "camp_assignments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "camp_assignments_camp_id_employee_id_key" ON "camp_assignments"("camp_id", "employee_id");

-- CreateIndex
CREATE INDEX "customers_organization_id_branch_id_idx" ON "customers"("organization_id", "branch_id");

-- CreateIndex
CREATE INDEX "employees_staff_category_idx" ON "employees"("staff_category");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_tasks" ADD CONSTRAINT "field_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_tasks" ADD CONSTRAINT "field_tasks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_tasks" ADD CONSTRAINT "field_tasks_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_tasks" ADD CONSTRAINT "field_tasks_late_reviewed_by_fkey" FOREIGN KEY ("late_reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_profiles" ADD CONSTRAINT "face_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camps" ADD CONSTRAINT "camps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camps" ADD CONSTRAINT "camps_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camps" ADD CONSTRAINT "camps_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_assignments" ADD CONSTRAINT "camp_assignments_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_assignments" ADD CONSTRAINT "camp_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

