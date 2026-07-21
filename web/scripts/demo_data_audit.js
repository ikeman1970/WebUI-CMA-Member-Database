const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const checks = {
    models: {},
    data: {}
  };

  const modelChecks = {
    account: () => prisma.account.count(),
    person: () => prisma.person.count(),
    chapter: () => prisma.chapter.count(),
    chapterReportingSnapshot: () => prisma.chapterReportingSnapshot.count(),
    accountInviteToken: () => prisma.accountInviteToken.count()
  };

  for (const [modelName, fn] of Object.entries(modelChecks)) {
    try {
      checks.models[modelName] = {
        ok: true,
        count: await fn()
      };
    } catch (error) {
      checks.models[modelName] = {
        ok: false,
        error: String(error?.message ?? error)
      };
    }
  }

  checks.data.people = await prisma.person.count();
  checks.data.chapters = await prisma.chapter.count();

  checks.data.peopleWithEmail = await prisma.person.count({
    where: {
      OR: [
        { emailHome: { not: null } },
        { emailWork: { not: null } }
      ]
    }
  });

  const accountSelectBase = {
    id: true,
    email: true,
    username: true,
    role: true,
    personId: true,
    chapterId: true
  };

  const linkedAccounts = await prisma.account.findMany({
    where: { personId: { not: null } },
    select: accountSelectBase,
    take: 25,
    orderBy: { createdAt: 'desc' }
  });

  checks.data.linkedAccounts = linkedAccounts.length;
  checks.data.linkedAccountSample = linkedAccounts.slice(0, 5);

  const demoCandidates = await prisma.person.findMany({
    where: {
      OR: [
        { emailHome: { not: null } },
        { emailWork: { not: null } }
      ]
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      emailHome: true,
      emailWork: true,
      chapterId: true
    },
    take: 10,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  });

  checks.data.demoCandidatePeople = demoCandidates;

  const structuralComplete = Object.values(checks.models).every((entry) => entry.ok === true);
  checks.summary = {
    structuralComplete,
    hasSeedMembers: checks.data.people > 0,
    hasLinkedMemberAccounts: checks.data.linkedAccounts > 0
  };

  console.log(JSON.stringify(checks, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
