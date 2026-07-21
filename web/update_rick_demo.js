const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const RICK_PERSON_ID = '6ec21505-8e78-4eaf-9de0-9cf7cec705b5';
const RR_CHAPTER_ID = '50d2cb18-c011-493a-b088-7de1d629dc42';
(async () => {
  const updated = await prisma.account.update({
    where: { id: '016235c9-7eb4-4a66-ab28-396296ef8f82' },
    data: {
      username: 'Rick Eichelberger',
      role: 'secretary',
      scopeType: 'chapter',
      chapterId: RR_CHAPTER_ID,
      personId: RICK_PERSON_ID,
      accountType: 'internal',
      type: 'admin'
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      scopeType: true,
      chapterId: true,
      personId: true
    }
  });
  console.log(JSON.stringify(updated, null, 2));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
