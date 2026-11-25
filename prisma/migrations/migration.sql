-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('CUSTOMER', 'AI_EMPLOYEE', 'OWNER_OVERRIDE');

-- CreateEnum
CREATE TYPE "ActivityActorType" AS ENUM ('OWNER', 'AI_EMPLOYEE', 'SYSTEM');

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Syarif',
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEmployee" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identityDescription" TEXT,
    "openaiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "maxTokens" INTEGER NOT NULL DEFAULT 1000,
    "historyWindowSize" INTEGER NOT NULL DEFAULT 15,
    "status" "AiStatus" NOT NULL DEFAULT 'INACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappNumber" (
    "id" TEXT NOT NULL,
    "aiEmployeeId" TEXT NOT NULL,
    "waPhoneNumberId" TEXT NOT NULL,
    "waDisplayNumber" TEXT NOT NULL,
    "waAccessTokenEnc" TEXT NOT NULL,
    "isConnected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "profileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "aiEmployeeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "isAiPaused" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "waMessageId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "content" TEXT NOT NULL,
    "tokenUsage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInstruction" (
    "id" TEXT NOT NULL,
    "aiEmployeeId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMemory" (
    "id" TEXT NOT NULL,
    "aiEmployeeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "factsSummary" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "aiEmployeeId" TEXT,
    "actorType" "ActivityActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Owner_email_key" ON "Owner"("email");

-- CreateIndex
CREATE INDEX "AiEmployee_ownerId_status_idx" ON "AiEmployee"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappNumber_aiEmployeeId_key" ON "WhatsappNumber"("aiEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappNumber_waPhoneNumberId_key" ON "WhatsappNumber"("waPhoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappNumber_waDisplayNumber_key" ON "WhatsappNumber"("waDisplayNumber");

-- CreateIndex
CREATE INDEX "WhatsappNumber_waPhoneNumberId_idx" ON "WhatsappNumber"("waPhoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_waId_key" ON "Customer"("waId");

-- CreateIndex
CREATE INDEX "Conversation_aiEmployeeId_lastMessageAt_idx" ON "Conversation"("aiEmployeeId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_aiEmployeeId_customerId_key" ON "Conversation"("aiEmployeeId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_waMessageId_key" ON "Message"("waMessageId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiInstruction_aiEmployeeId_isActive_priority_idx" ON "AiInstruction"("aiEmployeeId", "isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "AiMemory_aiEmployeeId_customerId_key" ON "AiMemory"("aiEmployeeId", "customerId");

-- CreateIndex
CREATE INDEX "ActivityLog_aiEmployeeId_createdAt_idx" ON "ActivityLog"("aiEmployeeId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiEmployee" ADD CONSTRAINT "AiEmployee_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappNumber" ADD CONSTRAINT "WhatsappNumber_aiEmployeeId_fkey" FOREIGN KEY ("aiEmployeeId") REFERENCES "AiEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_aiEmployeeId_fkey" FOREIGN KEY ("aiEmployeeId") REFERENCES "AiEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInstruction" ADD CONSTRAINT "AiInstruction_aiEmployeeId_fkey" FOREIGN KEY ("aiEmployeeId") REFERENCES "AiEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInstruction" ADD CONSTRAINT "AiInstruction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMemory" ADD CONSTRAINT "AiMemory_aiEmployeeId_fkey" FOREIGN KEY ("aiEmployeeId") REFERENCES "AiEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMemory" ADD CONSTRAINT "AiMemory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_aiEmployeeId_fkey" FOREIGN KEY ("aiEmployeeId") REFERENCES "AiEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;