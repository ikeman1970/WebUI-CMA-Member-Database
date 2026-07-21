const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_LIMIT = 12;
const seedLimit = Number.parseInt(process.env.DEMO_SEED_LIMIT || '', 10);
const limit = Number.isFinite(seedLimit) && seedLimit > 0 ? seedLimit : DEFAULT_LIMIT;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function chooseEmail(person) {
  const home = normalizeEmail(person.emailHome);
  const work = normalizeEmail(person.emailWork);
  return home || work || null;
}

function chooseUsername(person, email) {
  if (email) {
    return email;
  }

  const first = String(person.firstName || '').trim().toLowerCase();
  const last = String(person.lastName || '').trim().toLowerCase();
  const base = [first, last].filter(Boolean).join('.');
  return base || `member-${person.id.slice(0, 8)}`;
}

async function main() {
  const people = await prisma.person.findMany({
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
      chapterId: true,
      accounts: {
        select: {
          id: true,
          role: true,
          email: true
        }
      }
    },
    take: limit * 3,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  });

  let seeded = 0;
  const touched = [];

  for (const person of people) {
    if (seeded >= limit) {
      break;
    }

    const email = chooseEmail(person);
    const username = chooseUsername(person, email);

    const existing = person.accounts[0] || null;
    const accountData = {
      email,
      username,
      role: 'member',
      accountType: 'member',
      scopeType: 'chapter',
      type: 'member',
      chapterId: person.chapterId || null,
      personId: person.id,
      isDisabled: false
    };

    const account = existing
      ? await prisma.account.update({
          where: { id: existing.id },
          data: accountData,
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            personId: true,
            chapterId: true
          }
        })
      : await prisma.account.create({
          data: accountData,
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            personId: true,
            chapterId: true
          }
        });

    touched.push(account);
    seeded += 1;
  }

  const result = {
    seeded,
    limit,
    accounts: touched
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
