import { cache } from "react";

import { prisma } from "@/lib/prisma";

export const getProjectAccess = cache(async (userId: string, projectId: string) => {
  return prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
    include: {
      project: {
        include: {
          organization: true,
        },
      },
    },
  });
});

export async function assertProjectAccess(userId: string, projectId: string) {
  const membership = await getProjectAccess(userId, projectId);
  if (!membership) {
    throw new Error("You do not have access to this project.");
  }
  return membership;
}
