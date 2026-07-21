const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function tableExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'app'
        AND table_name = '${tableName}'
    ) AS exists`
  );
  return rows?.[0]?.exists === true;
}

async function columnExists(tableName, columnName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'app'
        AND table_name = '${tableName}'
        AND column_name = '${columnName}'
    ) AS exists`
  );
  return rows?.[0]?.exists === true;
}

async function main() {
  const people = await prisma.person.count();
  const accounts = await prisma.account.count();
  const linkedAccounts = await prisma.account.count({ where: { personId: { not: null } } });
  const peopleWithEmail = await prisma.person.count({
    where: {
      OR: [
        { emailHome: { not: null } },
        { emailWork: { not: null } }
      ]
    }
  });

  const memberRoleAccounts = await prisma.account.count({
    where: {
      role: { equals: 'member', mode: 'insensitive' }
    }
  });

  const requiredTables = [
    'accounts',
    'people',
    'chapters',
    'chapter_reporting_snapshots',
    'account_invite_tokens'
  ];

  const requiredColumns = [
    ['accounts', 'must_change_password'],
    ['accounts', 'auth_user_id'],
    ['accounts', 'last_password_change_at'],
    ['account_invite_tokens', 'token_hash'],
    ['account_invite_tokens', 'expires_at'],
    ['account_invite_tokens', 'used_at']
  ];

  const tableChecks = [];
  for (const tableName of requiredTables) {
    tableChecks.push({
      table: tableName,
      exists: await tableExists(tableName)
    });
  }

  const columnChecks = [];
  for (const [tableName, columnName] of requiredColumns) {
    columnChecks.push({
      column: `${tableName}.${columnName}`,
      exists: await columnExists(tableName, columnName)
    });
  }

  const summary = {
    counts: {
      people,
      accounts,
      linkedAccounts,
      peopleWithEmail,
      memberRoleAccounts
    },
    structure: {
      tables: tableChecks,
      columns: columnChecks
    }
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
