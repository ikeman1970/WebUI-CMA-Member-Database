const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function pushSchema() {
  execSync('npx prisma db push', {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: process.env
  });

  return { applied: true };
}

async function main() {
  const result = {
    schemaSync: null,
    summary: null
  };

  result.schemaSync = pushSchema();

  const models = {
    account: null,
    person: null,
    chapter: null,
    accountInviteToken: null
  };

  for (const modelName of Object.keys(models)) {
    try {
      models[modelName] = await prisma[modelName].count();
    } catch (error) {
      models[modelName] = { error: String(error?.message ?? error) };
    }
  }

  result.summary = {
    models
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
