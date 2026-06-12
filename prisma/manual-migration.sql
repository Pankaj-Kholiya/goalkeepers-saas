-- ===========================================================================
-- Manual application of the additive schema changes (Weekly Challenges,
-- Communications, password-reset tokens, classGrade columns).
--
-- USE THIS ONLY if you can't run `npm run db:push` / `npx prisma db push`
-- (which is the canonical way and produces the same result). Paste this into
-- the Neon SQL editor connected to your PRODUCTION database (use the
-- DIRECT/unpooled connection, i.e. the host WITHOUT "-pooler").
--
-- It is ADDITIVE and IDEMPOTENT: every statement uses IF NOT EXISTS, so it is
-- safe to run more than once and causes NO data loss. Naming matches Prisma's
-- conventions, so a later `prisma db push` will see no drift.
-- ===========================================================================

-- 1. New nullable columns on existing tables -------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "classGrade" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "classGrade" TEXT;
CREATE INDEX IF NOT EXISTS "Question_tenantId_classGrade_idx"
  ON "Question" ("tenantId", "classGrade");

-- 2. Password-reset tokens --------------------------------------------------
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id"        TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key"
  ON "PasswordResetToken" ("token");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
  ON "PasswordResetToken" ("userId");

-- 3. Weekly-challenge badge enum -------------------------------------------
DO $$ BEGIN
  CREATE TYPE "WeeklyChallengeBadge" AS ENUM
    ('LEGEND', 'PERFORMER', 'CHAMPION', 'STARTER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Weekly challenges ------------------------------------------------------
CREATE TABLE IF NOT EXISTS "WeeklyChallenge" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "classGrade"  TEXT NOT NULL,
  "weekKey"     TEXT NOT NULL,
  "openedAt"    TIMESTAMP(3) NOT NULL,
  "closedAt"    TIMESTAMP(3) NOT NULL,
  "questionIds" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyChallenge_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyChallenge_tenantId_classGrade_weekKey_key"
  ON "WeeklyChallenge" ("tenantId", "classGrade", "weekKey");
CREATE INDEX IF NOT EXISTS "WeeklyChallenge_tenantId_openedAt_idx"
  ON "WeeklyChallenge" ("tenantId", "openedAt");

-- 5. Weekly-challenge attempts ---------------------------------------------
CREATE TABLE IF NOT EXISTS "WeeklyChallengeAttempt" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "challengeId"  TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "answers"      TEXT,
  "correctCount" INTEGER NOT NULL DEFAULT 0,
  "badge"        "WeeklyChallengeBadge",
  "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt"  TIMESTAMP(3),
  CONSTRAINT "WeeklyChallengeAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyChallengeAttempt_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WeeklyChallengeAttempt_challengeId_fkey" FOREIGN KEY ("challengeId")
    REFERENCES "WeeklyChallenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WeeklyChallengeAttempt_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyChallengeAttempt_challengeId_userId_key"
  ON "WeeklyChallengeAttempt" ("challengeId", "userId");
CREATE INDEX IF NOT EXISTS "WeeklyChallengeAttempt_tenantId_idx"
  ON "WeeklyChallengeAttempt" ("tenantId");
CREATE INDEX IF NOT EXISTS "WeeklyChallengeAttempt_challengeId_correctCount_submittedAt_idx"
  ON "WeeklyChallengeAttempt" ("challengeId", "correctCount" DESC, "submittedAt");

-- 6. Communications ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Campaign" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "subject"     TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "audience"    TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'DRAFT',
  "sentCount"   INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Campaign_tenantId_createdAt_idx"
  ON "Campaign" ("tenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "CampaignRecipient" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "email"      TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignRecipient_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId")
    REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CampaignRecipient_tenantId_idx"
  ON "CampaignRecipient" ("tenantId");
CREATE INDEX IF NOT EXISTS "CampaignRecipient_campaignId_status_idx"
  ON "CampaignRecipient" ("campaignId", "status");

-- ---------------------------------------------------------------------------
-- Feedback: in-app support messages from schools + students. Created scoped
-- to the sender's tenant; the super-admin reads them all from /admin/support.
-- ("Role" enum already exists.) Additive + idempotent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Feedback" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "userId"    TEXT,
  "userEmail" TEXT NOT NULL,
  "userName"  TEXT,
  "role"      "Role" NOT NULL,
  "kind"      TEXT NOT NULL DEFAULT 'FEEDBACK',
  "message"   TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Feedback_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Feedback_tenantId_createdAt_idx"
  ON "Feedback" ("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Feedback_status_createdAt_idx"
  ON "Feedback" ("status", "createdAt");

-- ---------------------------------------------------------------------------
-- Notification: per-user activity events (quiz/challenge results). Additive +
-- idempotent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "body"      TEXT,
  "href"      TEXT,
  "readAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Notification_tenantId_userId_createdAt_idx"
  ON "Notification" ("tenantId", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx"
  ON "Notification" ("userId", "readAt");

-- ---------------------------------------------------------------------------
-- QuestionBookmark: a student's saved questions. Additive + idempotent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "QuestionBookmark" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionBookmark_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionBookmark_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuestionBookmark_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuestionBookmark_questionId_fkey" FOREIGN KEY ("questionId")
    REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionBookmark_userId_questionId_key"
  ON "QuestionBookmark" ("userId", "questionId");
CREATE INDEX IF NOT EXISTS "QuestionBookmark_tenantId_userId_createdAt_idx"
  ON "QuestionBookmark" ("tenantId", "userId", "createdAt");

-- ---------------------------------------------------------------------------
-- TenantIntegration: external Prayaas-product addons (Assessments + Website
-- AI Chatbot) a school connects. Additive + idempotent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TenantIntegration" (
  "id"                 TEXT NOT NULL,
  "tenantId"           TEXT NOT NULL,
  "product"            TEXT NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'NOT_ACTIVATED',
  "websiteUrl"         TEXT,
  "externalTenantSlug" TEXT,
  "externalBaseUrl"    TEXT,
  "widgetVersion"      TEXT,
  "manageUrl"          TEXT,
  "requestedByUserId"  TEXT,
  "requestedAt"        TIMESTAMP(3),
  "approvedAt"         TIMESTAMP(3),
  "notes"              TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantIntegration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantIntegration_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantIntegration_tenantId_product_key"
  ON "TenantIntegration" ("tenantId", "product");
CREATE INDEX IF NOT EXISTS "TenantIntegration_status_idx"
  ON "TenantIntegration" ("status");

-- ---------------------------------------------------------------------------
-- Referrals: gamified invite-a-classmate. Additive + idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key"
  ON "User" ("referralCode");

CREATE TABLE IF NOT EXISTS "Referral" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "refereeId"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Referral_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_refereeId_key"
  ON "Referral" ("refereeId");
CREATE INDEX IF NOT EXISTS "Referral_tenantId_referrerId_idx"
  ON "Referral" ("tenantId", "referrerId");

-- ---------------------------------------------------------------------------
-- Centralized School Brand Profile: the single source of truth the add-on
-- products (chatbot, social media, Prayaas) read via /api/tenant/profile.
-- Additive nullable columns on Tenant. Additive + idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "fontFamily" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "board" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "establishedYear" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tagline" TEXT;

-- ---------------------------------------------------------------------------
-- School archive: a recoverable shelf for inactive schools. archivedAt
-- non-null = archived (hidden + app-blocked); archivedFromStatus remembers the
-- status to restore to. Additive nullable columns on Tenant. Idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "archivedFromStatus" "TenantStatus";
CREATE INDEX IF NOT EXISTS "Tenant_archivedAt_idx" ON "Tenant" ("archivedAt");

-- ---------------------------------------------------------------------------
-- Pending paid-checkout columns on Subscription: hold the plan + Razorpay
-- order a school is buying, separate from the live plan, so an abandoned
-- checkout can't downgrade a paying school. Additive nullable. Idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "pendingPlanId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "pendingOrderId" TEXT;
CREATE INDEX IF NOT EXISTS "Subscription_pendingOrderId_idx"
  ON "Subscription" ("pendingOrderId");

-- ---------------------------------------------------------------------------
-- FeedbackReply: super-admin replies in the Support inbox (the thread is the
-- Feedback row + its replies). Additive + idempotent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FeedbackReply" (
  "id"         TEXT NOT NULL,
  "feedbackId" TEXT NOT NULL,
  "message"    TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackReply_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeedbackReply_feedbackId_fkey" FOREIGN KEY ("feedbackId")
    REFERENCES "Feedback" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FeedbackReply_feedbackId_createdAt_idx"
  ON "FeedbackReply" ("feedbackId", "createdAt");

-- ---------------------------------------------------------------------------
-- QuizEvent.classGrades: JSON array of target class labels (required >= 1 on
-- new events; null = legacy, visible to all). Additive nullable. Idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE "QuizEvent" ADD COLUMN IF NOT EXISTS "classGrades" TEXT;

-- ---------------------------------------------------------------------------
-- Remove the per-tenant module switches: every school now gets the full
-- feature set (the Modules concept was retired 2026-06). Idempotent.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "TenantModule";

-- ---------------------------------------------------------------------------
-- Two-way support threads + resolution rating: FeedbackReply gains an author
-- ('ADMIN' | 'USER'; existing rows are admin replies), Feedback gains the
-- sender's 0-5 star rating. Additive + idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE "FeedbackReply" ADD COLUMN IF NOT EXISTS "author" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
