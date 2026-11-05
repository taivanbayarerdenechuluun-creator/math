/**
 * Promotes an existing user to ADMIN:  npm run make-admin -- user@example.com
 * There is intentionally no web flow for this; it needs shell access to the server.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run make-admin -- user@example.com");
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}. Register the account first.`);
  const role = await db.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN" } });
  await db.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  await db.auditLog.create({ data: { actorId: null, action: "user.promote-cli", target: user.id } });
  console.log(`${email} is now an administrator.`);
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
