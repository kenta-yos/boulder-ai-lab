-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gym" TEXT,
    "grade" TEXT,
    "summary" TEXT NOT NULL,
    "prescription" TEXT NOT NULL,
    "thumbnail" TEXT,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);
