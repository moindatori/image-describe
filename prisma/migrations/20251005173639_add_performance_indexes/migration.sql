-- CreateIndex
CREATE INDEX "credit_transactions_userId_idx" ON "public"."credit_transactions"("userId");

-- CreateIndex
CREATE INDEX "credit_transactions_createdAt_idx" ON "public"."credit_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "credit_transactions_userId_type_idx" ON "public"."credit_transactions"("userId", "type");

-- CreateIndex
CREATE INDEX "image_descriptions_userId_idx" ON "public"."image_descriptions"("userId");

-- CreateIndex
CREATE INDEX "image_descriptions_createdAt_idx" ON "public"."image_descriptions"("createdAt");

-- CreateIndex
CREATE INDEX "image_descriptions_userId_createdAt_idx" ON "public"."image_descriptions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_requests_userId_idx" ON "public"."payment_requests"("userId");

-- CreateIndex
CREATE INDEX "payment_requests_status_idx" ON "public"."payment_requests"("status");

-- CreateIndex
CREATE INDEX "payment_requests_createdAt_idx" ON "public"."payment_requests"("createdAt");

-- CreateIndex
CREATE INDEX "payment_requests_status_createdAt_idx" ON "public"."payment_requests"("status", "createdAt");
