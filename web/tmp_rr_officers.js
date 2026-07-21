const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const chapters = await prisma.chapter.findMany({
    where: {
      OR: [
        { name: { contains: 'Righteous Riders', mode: 'insensitive' } },
        { number: { contains: 'Righteous Riders', mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      number: true,
      name: true,
      state: true,
      assignments: {
        where: {
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } }
          ]
        },
        select: {
          role: true,
          person: {
            select: {
              firstName: true,
              lastName: true,
              cmaNumber: true
            }
          }
        },
        orderBy: [{ role: 'asc' }]
      }
    }
  });
  console.log(JSON.stringify(chapters, null, 2));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
