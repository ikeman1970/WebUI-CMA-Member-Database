const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const accounts = await prisma.account.findMany({
    where: {
      OR: [
        { username: { equals: 'Rick Eichelberger', mode: 'insensitive' } },
        { username: { contains: 'Rick', mode: 'insensitive' } },
        { email: { contains: 'rick', mode: 'insensitive' } },
        { person: { firstName: { equals: 'Rick', mode: 'insensitive' } } },
        { person: { lastName: { contains: 'Eichelberger', mode: 'insensitive' } } }
      ]
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      scopeType: true,
      chapterId: true,
      person: {
        select: {
          firstName: true,
          lastName: true,
          cmaNumber: true,
          chapterId: true,
          officerAssignments: {
            where: {
              OR: [
                { endDate: null },
                { endDate: { gte: new Date() } }
              ]
            },
            select: {
              chapterId: true,
              role: true,
              startDate: true,
              endDate: true
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(accounts, null, 2));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
