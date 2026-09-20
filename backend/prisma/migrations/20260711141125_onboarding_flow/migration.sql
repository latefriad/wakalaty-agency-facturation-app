-- Flux onboarding : nouveaux champs Agency.
ALTER TABLE "agencies" ADD COLUMN "onboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "agencyType" TEXT,
ADD COLUMN "teamSize" TEXT,
ADD COLUMN "goals" JSONB;

-- Les agences existantes ont déjà été configurées : ne pas les renvoyer
-- vers l'onboarding. Les nouvelles hériteront du DEFAULT false.
UPDATE "agencies" SET "onboarded" = true;
