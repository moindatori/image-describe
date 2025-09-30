-- AlterTable
ALTER TABLE "public"."payment_requests" ADD COLUMN     "qrCodeUsed" TEXT,
ADD COLUMN     "transactionId" TEXT;
