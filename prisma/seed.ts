import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);
  const reviewer = await prisma.user.upsert({
    where: { email: "sourav@example.com" },
    update: { passwordHash },
    create: {
      email: "sourav@example.com",
      name: "Sourav Reviewer",
      passwordHash,
    },
  });

  const otherUser = await prisma.user.upsert({
    where: { email: "restricted@example.com" },
    update: { passwordHash },
    create: {
      email: "restricted@example.com",
      name: "Restricted Reviewer",
      passwordHash,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "northstar-evidence-lab" },
    update: {},
    create: {
      name: "Northstar Evidence Lab",
      slug: "northstar-evidence-lab",
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: reviewer.id,
        organizationId: organization.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      userId: reviewer.id,
      organizationId: organization.id,
      role: "OWNER",
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: otherUser.id,
        organizationId: organization.id,
      },
    },
    update: { role: "MEMBER" },
    create: {
      userId: otherUser.id,
      organizationId: organization.id,
      role: "MEMBER",
    },
  });

  const diabetesProject = await prisma.project.upsert({
    where: { id: "demo-diabetes-review" },
    update: {},
    create: {
      id: "demo-diabetes-review",
      name: "Digital Health and Chronic Care",
      description: "Screen imported PubMed-style search results for evidence about digital health workflows.",
      organizationId: organization.id,
    },
  });

  const restrictedProject = await prisma.project.upsert({
    where: { id: "restricted-cardiology-review" },
    update: {},
    create: {
      id: "restricted-cardiology-review",
      name: "Restricted Cardiology Review",
      description: "A seeded project intentionally hidden from the demo reviewer.",
      organizationId: organization.id,
    },
  });

  await prisma.projectMember.upsert({
    where: {
      userId_projectId: {
        userId: reviewer.id,
        projectId: diabetesProject.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      userId: reviewer.id,
      projectId: diabetesProject.id,
      role: "OWNER",
    },
  });

  await prisma.projectMember.upsert({
    where: {
      userId_projectId: {
        userId: otherUser.id,
        projectId: restrictedProject.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      userId: otherUser.id,
      projectId: restrictedProject.id,
      role: "OWNER",
    },
  });

  console.log("Seeded demo reviewer:");
  console.log("  email: sourav@example.com");
  console.log("  password: Password123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
