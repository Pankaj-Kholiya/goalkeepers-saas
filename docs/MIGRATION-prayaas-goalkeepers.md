# Migrating the "GoalKeepers" feature out of Prayaas into goalkeepers-saas

This brief inventories the **GoalKeepers section that currently lives inside
the Prayaas app** (`I:\Dev Prayaas\prayaaas`) and maps it onto this
standalone platform (`goalkeepers-saas`) so the feature can be lifted across.

> Naming note: "GoalKeepers" means two different things right now.
> - **In Prayaas:** a sidebar section (Questions, Tests, Weekly Challenges,
>   Communications) - a set of features bolted onto the single Prayaas org.
> - **Here (goalkeepers-saas):** the multi-tenant *platform*. The assessment
>   features are the **Prayaas module**.
>
> So the migration is really: take the Prayaas GoalKeepers features and land
> them as capabilities of the **Prayaas module** (plus a new **Communications**
> module), now multi-tenant.

---

## 1. What the GoalKeepers section is, in Prayaas

Four sub-features, reached from an admin sidebar group ("GoalKeepers"):

| Sub-feature | What it is | Owns its own tables? |
| --- | --- | --- |
| **Questions** | A question bank on the `PRACTICE` track (vs `BOARD_EXAM`). Same `Question` table, filtered by `track`. | No - shared `Question` |
| **Tests** | Admin-composed practice papers (pick questions, set duration/marks, publish). Same `Test` table, `track = PRACTICE`. | No - shared `Test`/`TestQuestion` |
| **Weekly Challenges** | The headline: a Saturday 5-question quiz, one MCQ/MSQ per canonical subject, auto-generated per class, students earn badges (Legend/Performer/Champion/Starter). | **Yes** - `WeeklyChallenge`, `WeeklyChallengeAttempt` |
| **Communications** | Bulk email campaigns to filtered student audiences. | No - shared `Campaign`/`CampaignRecipient`/`Notification` |

The only **GoalKeepers-owned data** is Weekly Challenges. Everything else
rides on tables Prayaas already had.

---

## 2. Source inventory (Prayaas) - routes + files

### 2.1 Questions (PRACTICE bank)
- Routes: `/admin/goalkeepers/questions` (list + filters: class, subject, type,
  difficulty, active), `/new`, `/[id]/edit`, `/bulk-import` (CSV).
- Actions: `admin/goalkeepers/questions/actions.ts` -
  `createQuestionAction`, `updateQuestionAction`, `toggleQuestionActiveAction`,
  `deleteQuestionAction`, `deleteAllQuestionsAction`, `bulkCreateQuestionsAction`.
- Components: `QuestionFormFields.tsx`, `bulk-import/QuestionBulkImportClient.tsx`.
- Notes: MCQ/MSQ only for the challenge use-case; classes VIII-XII; Bloom level,
  estimatedSolveSec, blueprintWeight metadata; soft-delete via `isActive` (hard
  delete blocked if referenced by a test/answer).

### 2.2 Tests (PRACTICE papers)
- Routes: `/admin/goalkeepers/tests` (list), `/new`, `/[id]/edit`,
  `/[id]/questions` (drag-drop composer + per-question marks override),
  `/[id]/qp-health` (question-paper evaluation report).
- Actions: `admin/goalkeepers/tests/actions.ts` - create/update/delete,
  add/remove/move question, publish/unpublish, `runQpHealthCheckAction`.
- Component: `TestFormFields.tsx`.

### 2.3 Weekly Challenges (the headline)
- Admin: `/admin/goalkeepers` (list of 50 most-recent challenges: status, attempts,
  top-3, badge distribution), `/admin/goalkeepers/[challengeId]` (the 5 picked
  questions + full leaderboard).
- Student: `/student/goalkeepers` (4 states: class-not-set / upcoming / live /
  closed; leaderboard + trophy wall + badge-tier card),
  `/[challengeId]/attempt` (single-page 5-question taker),
  `/[challengeId]/result` (score + badge + leaderboard; premium sees answer key).
- Public: `/goalkeepers`, `/goalkeepers/leaderboard`, `/goalkeepers/teacher-portal`.
- School: `/school/goalkeepers` (placeholder "coming soon").
- Actions: `student/goalkeepers/actions.ts` -
  `startWeeklyChallengeAttemptAction` (idempotent: ensures challenge + attempt,
  redirects), `submitWeeklyChallengeAction` (grades, assigns badge, emails,
  redirects to result).
- Engine: `lib/weekly-challenge.ts` (see section 4).

### 2.4 Communications
- Routes: `/admin/communications` (campaign history + delivery-rate KPI),
  `/new` (audience picker: all / by edition / by school / by class + compose +
  live audience count), `/[campaignId]` (detail + stats + resend).
- Action: `admin/communications/actions.ts` - `sendCampaignAction`
  (queues, status SENDING, sends async).
- Channel: **email only** in v1 (WhatsApp/SMS reserved in schema, UI hidden).

---

## 3. Data model in Prayaas

### GoalKeepers-OWNED (must be created here) - source: `prisma/schema.prisma`

```prisma
model WeeklyChallenge {
  id          String   @id @default(cuid())
  classGrade  String
  weekKey     String   // ISO 8601, e.g. "2026-W18"
  openedAt    DateTime
  closedAt    DateTime
  questionIds String   @db.Text // JSON array of 5 question IDs, pinned at creation
  createdAt   DateTime @default(now())
  attempts    WeeklyChallengeAttempt[]
  @@unique([classGrade, weekKey])   // one challenge per class per week
  @@index([openedAt])
}

model WeeklyChallengeAttempt {
  id           String   @id @default(cuid())
  challengeId  String
  challenge    WeeklyChallenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  answers      String?  @db.Text  // JSON { [questionId]: '"a"' | '["a","c"]' }
  correctCount Int      @default(0)
  badge        WeeklyChallengeBadge?
  startedAt    DateTime @default(now())
  submittedAt  DateTime?
  @@unique([challengeId, userId]) // one attempt per student per challenge
  @@index([userId])
  @@index([challengeId, correctCount(sort: Desc), submittedAt]) // leaderboard
}

enum WeeklyChallengeBadge { LEGEND PERFORMER CHAMPION STARTER } // 5/4/3/2 of 5
```

### SHARED with core Prayaas (referenced, NOT owned)
- `Question` - challenge picks from `track = PRACTICE`; `WeeklyChallenge.questionIds`
  stores the chosen IDs as JSON.
- `Test`, `TestQuestion`, `TestSession.practicePlan` - the Tests sub-feature.
- `User` / `Student` (class lives on the student profile) / `School`.
- `Campaign`, `CampaignRecipient`, `Notification` - the Communications sub-feature.

### Migration seams (the foreign keys that cross into core)
- `WeeklyChallengeAttempt.userId -> User.id`
- `WeeklyChallenge.questionIds -> Question.id[]` (JSON, picked from PRACTICE track)
- class identity = `Student.classGrade` string (no Class table)
- Communications recipients = `Student` rows filtered by edition/school/class.

---

## 4. Business logic + jobs (Prayaas)

### `lib/weekly-challenge.ts` (the engine)
- `WEEKLY_CHALLENGE_SUBJECTS = ['Mathematics','Science','English','Social Science','Hindi']`
  (hardcoded, Indian-curriculum canonical set), `QUIZ_QUESTION_COUNT = 5`.
- `getChallengeWindow(now?)` -> `{ weekKey, openedAt, closedAt, isLive, isUpcoming, isClosed }`.
  Window = Saturday 00:00 -> Sunday 00:00, computed in **server-local time** (see gotcha).
- `pickWeeklyChallengeQuestions(classGrade)` -> picks one random active MCQ/MSQ per
  subject from the PRACTICE bank for that class; returns 5 IDs (or fails if any
  subject is empty).
- `ensureWeeklyChallenge(classGrade, window)` -> finds-or-creates the row (lazy).
- `badgeForScore(correct)` -> `5->LEGEND, 4->PERFORMER, 3->CHAMPION, 2->STARTER, else null`.
- `BADGE_META` -> per-tier label / cue / hint / gradient colours.
- `getChallengeLeaderboard(challengeId, limit?)`.

### Grading - `lib/scoring.ts`
- `matchesMcqMsq(type, correctAnswer, payload)` -> boolean (MSQ needs the exact set,
  no partial credit). The challenge tallies raw `correctCount` (0-5); it does NOT use
  negative marking.

### Email - `lib/notifications.ts` + `lib/mailer.ts` + `lib/email-templates.ts`
- On submit, `notify({... email: true})` writes a Notification row AND sends an email
  via **Zoho SMTP** (nodemailer). `isLikelyDeliverableEmail()` skips non-routable
  addresses (.local/.test/example.com) so placeholder student emails don't bounce.
- Communications campaigns use the same mailer for bulk sends.

### Scheduling
- **There is NO cron.** Challenges are generated lazily on the first student visit
  during the live window. If nobody opens it, no challenge is created that week.

---

## 5. External dependencies + env (Prayaas)
- **Email:** Zoho Mail over SMTP via `nodemailer`. Env: `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- **DB:** MySQL (Prayaas) - note this project is **Postgres/Neon**, so column types
  differ (`@db.Text` -> Postgres `String`/`@db.Text`; both fine).
- **No** SMS/WhatsApp, **no** cron, **no** queue. All work is server actions.
- **Timezone:** display uses IST (`Asia/Kolkata`), but the challenge *window* is
  computed in server-local time - a known bug to fix on migration.

---

## 6. What goalkeepers-saas ALREADY has (don't rebuild these)

| Need | Already here |
| --- | --- |
| Per-tenant question bank (MCQ/MSQ + 4 more types) | `Question` (tenant-scoped) + `/dashboard/questions` |
| Composed quizzes (pinned/sampled), live + async | `QuizEvent` + `/dashboard/events` |
| MCQ/MSQ grading | `src/lib/scoring.ts` (`matchesMcqMsq`, `scoreMcqMsq`) |
| Badge tiers, leaderboards | `src/lib/quiz.ts` + results pages |
| Question sampler | `src/lib/quiz.ts` `sampleQuestionIds()` |
| Multi-tenant isolation | `src/lib/db.ts` extension (fails closed) |
| Module on/off per school | `TenantModule` + `src/lib/modules.ts` |

So **Questions and Tests are essentially already covered** by `Question` and
`QuizEvent`. The real new build is **Weekly Challenges** and **Communications**.

---

## 7. Migration mapping (Prayaas GoalKeepers -> goalkeepers-saas)

| Prayaas piece | Lands here as | Effort |
| --- | --- | --- |
| Questions (PRACTICE) | Existing `Question` model + Questions UI. Add a `classGrade` concept (see below). | Low |
| Tests (PRACTICE) | Existing `QuizEvent` (pinned selection). Optionally port "QP health". | Low-Med |
| **Weekly Challenges** | **New** `WeeklyChallenge` + `WeeklyChallengeAttempt` (tenant-scoped) + a `weekly-challenge.ts` engine + admin/student pages. Reuse `scoring.matchesMcqMsq` and the badge/leaderboard patterns. | **High** |
| **Communications** | **New** `Campaign` + `CampaignRecipient` (tenant-scoped) + an email provider + admin pages. | **Med-High** |
| Badge tiers + email-on-submit | Port `badgeForScore`/`BADGE_META`; wire an email provider. | Low-Med |

### The three things that change because we're now multi-tenant

1. **Tenant scoping.** Every new table gets a `tenantId` and must be added to
   `TENANT_SCOPED_MODELS` in `src/lib/db.ts`. `WeeklyChallenge` uniqueness becomes
   `@@unique([tenantId, classGrade, weekKey])`.
2. **Classes + subjects are per-tenant, not hardcoded.** Prayaas hardcodes classes
   VIII-XII and 5 Indian subjects. Here each school defines its own. Options:
   - add `classGrade String?` to `Question` and let each tenant configure its class
     list + the subject set used for the weekly challenge (store on `Tenant` or a
     small `TenantModuleConfig`/settings JSON), **or**
   - derive the challenge subjects from whatever subjects that tenant's PRACTICE
     questions actually cover. Recommended: a configurable subject list per tenant,
     defaulting to the distinct subjects in their bank.
3. **Email provider.** Pick one provider for the platform (Resend/SendGrid/SMTP) and
   put it behind a `src/lib/mailer.ts` here; reuse it for both challenge result
   emails and Communications campaigns.

---

## 8. Proposed schema additions (Postgres, tenant-scoped)

```prisma
enum WeeklyChallengeBadge { LEGEND PERFORMER CHAMPION STARTER }

model WeeklyChallenge {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  classGrade  String
  weekKey     String
  openedAt    DateTime
  closedAt    DateTime
  questionIds String   // JSON array of 5 Question ids, pinned at creation
  createdAt   DateTime @default(now())
  attempts    WeeklyChallengeAttempt[]
  @@unique([tenantId, classGrade, weekKey])
  @@index([tenantId, openedAt])
}

model WeeklyChallengeAttempt {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  challengeId  String
  challenge    WeeklyChallenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  answers      String?
  correctCount Int      @default(0)
  badge        WeeklyChallengeBadge?
  startedAt    DateTime @default(now())
  submittedAt  DateTime?
  @@unique([challengeId, userId])
  @@index([tenantId])
  @@index([challengeId, correctCount(sort: Desc), submittedAt])
}

model Campaign {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  subject     String
  body        String
  audience    String   // JSON: { kind: 'all'|'class', classGrade?: string }
  status      String   @default("DRAFT") // DRAFT|SENDING|SENT|FAILED
  sentCount   Int      @default(0)
  failedCount Int      @default(0)
  createdAt   DateTime @default(now())
  recipients  CampaignRecipient[]
  @@index([tenantId, createdAt])
}

model CampaignRecipient {
  id         String   @id @default(cuid())
  tenantId   String
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  userId     String
  email      String
  status     String   @default("PENDING") // PENDING|SENT|FAILED
  @@index([tenantId])
  @@index([campaignId, status])
}
```

Then: add `WeeklyChallenge`, `WeeklyChallengeAttempt`, `Campaign`,
`CampaignRecipient` to `TENANT_SCOPED_MODELS` in `src/lib/db.ts`, add the
back-relations on `Tenant` and `User`, and `npx prisma db push`.

Also add `classGrade String?` to the existing `Question` model (the weekly
challenge needs to pick by class).

---

## 9. Where it fits in the module system

Keep it inside the **module architecture** this platform already has:

- **Weekly Challenges, Questions, Tests** -> all belong to the existing **Prayaas
  module** (`src/lib/modules.ts`, key `prayaas`). Add a "Weekly Challenges" nav
  item to that module's `nav` and gate its pages with
  `await requireModule('prayaas')`.
- **Communications** -> add a **new module** `communications` (per the "adding a
  module" steps in `docs/GOALKEEPERS.md`): a `ModuleDef`, an icon key, pages under
  `src/app/dashboard/communications/...` guarded by `requireModule('communications')`,
  default off. The super-admin then sells/toggles it per school.

This keeps the white-label, per-tenant-billing story intact: a school buys
Prayaas (gets challenges) and optionally Communications.

---

## 10. Step-by-step migration plan

1. **Schema**: add the 4 models + enum from section 8; add `Question.classGrade`;
   register the new tenant-scoped models in `db.ts`; `prisma db push`.
2. **Engine**: port `weekly-challenge.ts` (window, ensure, pick, badge, leaderboard)
   into `src/lib/weekly-challenge.ts`, made tenant-aware and **IST-correct** (compute
   the Saturday window in `Asia/Kolkata`, not server-local). Reuse `scoring.matchesMcqMsq`.
3. **Subjects/classes**: add per-tenant config for the class list + the challenge
   subject set (default = distinct subjects in that tenant's PRACTICE questions).
4. **Cron (recommended, fixes the lazy gap)**: add a Vercel cron (`vercel.json`) hitting
   `/api/cron/weekly-challenge` every Saturday morning IST to pre-generate each
   tenant+class challenge, instead of relying on a student click.
5. **Student pages**: `/dashboard/challenges` (states: upcoming/live/closed),
   `/[id]/attempt`, `/[id]/result` (badge + leaderboard). Gate on `requireModule('prayaas')`.
6. **Admin/teacher pages**: a challenges overview + per-challenge detail (reuse
   `PageHeader`, `StatCard`, `Table`, `Badge`, `EmptyState`).
7. **Email**: add `src/lib/mailer.ts` (one provider) + a result-email template; send
   on submit, with the deliverability guard.
8. **Communications module**: register the module, build `/dashboard/communications`
   (list/new/[id]) + `sendCampaignAction`, reuse the mailer.
9. **Verify**: `tsc` + `eslint` + `next build`; extend `scripts/smoke-isolation.ts`
   to cover the new tables; manually run a Saturday challenge end-to-end.
10. **Decommission** the GoalKeepers section in Prayaas once parity is confirmed
    (or leave it; the two are now independent products).

---

## 11. Gotchas to carry over (or fix)

- **Timezone:** Prayaas computes the Saturday window in server-local time, not IST.
  Fix on migration - compute in `Asia/Kolkata`.
- **No cron in Prayaas:** challenges only exist if a student opens them. Add a cron
  here so every class has a challenge each week regardless of traffic.
- **Question immutability:** pin the 5 chosen IDs on the challenge row at creation
  (Prayaas already does this) so later bank edits don't change a live/closed challenge.
- **MSQ = exact set:** no partial credit; the grader needs the full correct set.
- **Soft-delete questions:** hard delete is blocked when a question is referenced;
  keep `isActive` semantics.
- **Email deliverability:** keep the `.local/.test/example.com` skip so school-managed
  placeholder student emails don't generate bounces.
- **DB engine:** Prayaas is MySQL, this is Postgres - port column types and re-test
  the leaderboard index (`@@index([challengeId, correctCount(sort: Desc), submittedAt])`).

---

*Source of truth for the destination conventions: `docs/GOALKEEPERS.md` (platform +
module architecture) and `prisma/schema.prisma` (current models).*
