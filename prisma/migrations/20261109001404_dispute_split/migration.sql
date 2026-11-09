-- AlterEnum
ALTER TYPE "DisputeOutcome" ADD VALUE 'SPLIT';

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "transferId" TEXT,
ADD COLUMN     "travellerAmount" INTEGER;
