-- CreateEnum
CREATE TYPE "TravellerLevel" AS ENUM ('ARINRIN_AJO', 'OLOOOTO', 'ATONA', 'AGBA');

-- CreateEnum
CREATE TYPE "Proposer" AS ENUM ('SENDER', 'TRAVELLER');

-- Ajo Verified is folded into the Olóòótọ́ traveller level.
-- Requests that required Ajo Verified now require Olóòótọ́.
ALTER TABLE "DeliveryRequest" ADD COLUMN "minLevel" "TravellerLevel" NOT NULL DEFAULT 'ARINRIN_AJO';
UPDATE "DeliveryRequest" SET "minLevel" = 'OLOOOTO' WHERE "minTrustTier" = 'AJO_VERIFIED';
ALTER TABLE "DeliveryRequest" DROP COLUMN "minTrustTier";

-- Ajo Verified users keep carrying as ID Verified; their level comes from their record.
UPDATE "User" SET "trustTier" = 'ID_VERIFIED' WHERE "trustTier" = 'AJO_VERIFIED';

-- Drop AJO_VERIFIED from TrustTier
CREATE TYPE "TrustTier_new" AS ENUM ('UNVERIFIED', 'ID_VERIFIED');
ALTER TABLE "User" ALTER COLUMN "trustTier" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "trustTier" TYPE "TrustTier_new" USING ("trustTier"::text::"TrustTier_new");
ALTER TYPE "TrustTier" RENAME TO "TrustTier_old";
ALTER TYPE "TrustTier_new" RENAME TO "TrustTier";
DROP TYPE "TrustTier_old";
ALTER TABLE "User" ALTER COLUMN "trustTier" SET DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "bonusTransferId" TEXT,
ADD COLUMN     "levelBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "proposedBy" "Proposer" NOT NULL DEFAULT 'SENDER',
ADD COLUMN     "travellerLevel" "TravellerLevel";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "elderApprovedAt" TIMESTAMP(3),
ADD COLUMN     "onTimeDeliveries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratingSum" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "travellerCancellations" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "travellerId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_bookingId_key" ON "Rating"("bookingId");

-- CreateIndex
CREATE INDEX "Rating_travellerId_createdAt_idx" ON "Rating"("travellerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_travellerId_fkey" FOREIGN KEY ("travellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

