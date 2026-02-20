import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function resolveRetentionDays() {
  const cliValue = process.argv[2];
  const envValue = process.env.AUDIT_RETENTION_DAYS;
  const raw = cliValue || envValue || '90';
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('AUDIT_RETENTION_DAYS deve ser um inteiro positivo');
  }

  return parsed;
}

async function main() {
  const retentionDays = resolveRetentionDays();
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.auditEvent.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(
    `Audit cleanup concluído: ${result.count} eventos removidos (retenção: ${retentionDays} dias).`,
  );
}

main()
  .catch((error) => {
    console.error('Falha no cleanup de auditoria:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
