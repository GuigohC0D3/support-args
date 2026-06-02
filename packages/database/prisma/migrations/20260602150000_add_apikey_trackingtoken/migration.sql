-- AlterTable
ALTER TABLE "projects" ADD COLUMN "apiKey" TEXT;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "trackingToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "projects_apiKey_key" ON "projects"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_trackingToken_key" ON "tickets"("trackingToken");
