import { AnnouncementStatus, Prisma } from "@/db/types"

import { prisma } from "@/db/client"

export const customPageInclude = {
  creator: {
    select: {
      username: true,
      nickname: true,
    },
  },
} satisfies Prisma.CustomPageInclude

export type CustomPageRow = Prisma.CustomPageGetPayload<{
  include: typeof customPageInclude
}>

interface CustomPageMutationInput {
  title: string
  routePath: string
  htmlContent: string
  status: AnnouncementStatus
  includeHeader: boolean
  includeFooter: boolean
  includeLeftSidebar: boolean
  includeRightSidebar: boolean
  publishedAt: Date | null
}

function buildWhereClause(options: {
  id?: string
  routePath?: string
  publishedOnly?: boolean
}): Prisma.CustomPageWhereInput {
  return {
    ...(options.id ? { id: options.id } : {}),
    ...(options.routePath ? { routePath: options.routePath } : {}),
    ...(options.publishedOnly ? { status: AnnouncementStatus.PUBLISHED } : {}),
  }
}

async function findCustomPages(options: {
  id?: string
  routePath?: string
  publishedOnly?: boolean
  limit?: number
}) {
  return prisma.customPage.findMany({
    where: buildWhereClause(options),
    orderBy: [
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: typeof options.limit === "number" ? options.limit : undefined,
    include: customPageInclude,
  })
}

export function findAdminCustomPages() {
  return findCustomPages({})
}

export async function findCustomPageById(id: string) {
  const record = await prisma.customPage.findUnique({
    where: { id },
    include: customPageInclude,
  })

  return record ?? null
}

export async function findCustomPageByRoutePath(routePath: string) {
  const record = await prisma.customPage.findUnique({
    where: { routePath },
    include: customPageInclude,
  })

  return record ?? null
}

export async function findPublishedCustomPageByRoutePath(routePath: string) {
  const [record] = await findCustomPages({
    routePath,
    publishedOnly: true,
    limit: 1,
  })

  return record ?? null
}

export function createCustomPageRecord(data: CustomPageMutationInput & { createdBy: number }) {
  return prisma.customPage.create({
    data,
    include: customPageInclude,
  })
}

export function updateCustomPageRecordById(id: string, data: CustomPageMutationInput) {
  return prisma.customPage.update({
    where: { id },
    data,
    include: customPageInclude,
  })
}

export function deleteCustomPageRecordById(id: string) {
  return prisma.customPage.delete({ where: { id } })
}

export async function listPublishedCustomPagePathsWithoutFooter() {
  const rows = await prisma.customPage.findMany({
    where: {
      status: AnnouncementStatus.PUBLISHED,
      includeFooter: false,
    },
    select: {
      routePath: true,
    },
  })

  return rows.map((item) => item.routePath)
}
