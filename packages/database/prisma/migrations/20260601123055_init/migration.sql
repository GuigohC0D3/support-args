-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('NOT_WORKING', 'QUESTION', 'PAYMENTS', 'ACCOUNT_ACCESS', 'SUGGESTION');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "category" "TicketCategory";
