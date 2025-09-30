-- AlterTable
ALTER TABLE "public"."payment_requests" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'PKR',
ADD COLUMN     "location" TEXT NOT NULL DEFAULT 'pakistan';
