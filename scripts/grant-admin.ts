// Usage: npm run admin:grant -- someone@example.com
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.toLowerCase();
if (!email) {
  console.error("Usage: npm run admin:grant -- <email>");
  process.exit(1);
}

const db = new PrismaClient();
db.user
  .update({ where: { email }, data: { role: "ADMIN" } })
  .then((u) => console.log(`${u.email} is now an admin`))
  .catch(() => {
    console.error(`No user with email ${email}. They need to sign in once first.`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
