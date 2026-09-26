-- CreateEnum
CREATE TYPE "Location" AS ENUM ('LAGOS', 'LONDON', 'NEW_YORK');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('UNVERIFIED', 'ID_VERIFIED', 'AJO_VERIFIED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BIRTH_CERTIFICATE', 'MARRIAGE_CERTIFICATE', 'NIN_SLIP', 'UNIVERSITY_CERTIFICATE', 'TRANSCRIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('OPEN', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'BOOKED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PROPOSED', 'DECLINED', 'ACCEPTED', 'FUNDED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('PICKED_UP', 'ARRIVED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'CLAIMED', 'CONFIRMED', 'DISPUTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trustTier" "TrustTier" NOT NULL DEFAULT 'UNVERIFIED',
    "kycSessionId" TEXT,
    "stripeAccountId" TEXT,
    "completedDeliveries" INTEGER NOT NULL DEFAULT 0,
    "upheldDisputes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "travellerId" TEXT NOT NULL,
    "origin" "Location" NOT NULL,
    "destination" "Location" NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "cancellationPolicy" "CancellationPolicy" NOT NULL DEFAULT 'MODERATE',
    "notes" TEXT,
    "status" "TripStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRequest" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "description" TEXT,
    "origin" "Location" NOT NULL,
    "destination" "Location" NOT NULL,
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "minTrustTier" "TrustTier" NOT NULL DEFAULT 'ID_VERIFIED',
    "pickupCity" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PROPOSED',
    "currency" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "travellerPayout" INTEGER NOT NULL,
    "serviceFee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "cancellationPolicy" "CancellationPolicy" NOT NULL,
    "paymentIntentId" TEXT,
    "transferGroup" TEXT NOT NULL,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "fundedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "MilestoneType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "payout" INTEGER NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "claimedAt" TIMESTAMP(3),
    "claimExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "transferId" TEXT,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Trip_origin_destination_departureAt_idx" ON "Trip"("origin", "destination", "departureAt");

-- CreateIndex
CREATE INDEX "DeliveryRequest_origin_destination_deadline_idx" ON "DeliveryRequest"("origin", "destination", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_paymentIntentId_key" ON "Booking"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_transferGroup_key" ON "Booking"("transferGroup");

-- CreateIndex
CREATE INDEX "Booking_tripId_idx" ON "Booking"("tripId");

-- CreateIndex
CREATE INDEX "Booking_requestId_idx" ON "Booking"("requestId");

-- CreateIndex
CREATE INDEX "Milestone_status_claimExpiresAt_idx" ON "Milestone"("status", "claimExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_bookingId_type_key" ON "Milestone"("bookingId", "type");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_travellerId_fkey" FOREIGN KEY ("travellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRequest" ADD CONSTRAINT "DeliveryRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DeliveryRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
