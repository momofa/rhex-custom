import { Prisma, RssEntryReviewStatus } from "@/db/types"

import { prisma } from "@/db/client"

const rssEntryAdminSelect = {
  id: true,
  sourceId: true,
  guid: true,
  linkUrl: true,
  title: true,
  author: true,
  summary: true,
  contentHtml: true,
  contentText: true,
  publishedAt: true,
  reviewStatus: true,
  reviewNote: true,
  reviewedById: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  source: {
    select: {
      id: true,
      siteName: true,
    },
  },
  reviewer: {
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  },
} satisfies Prisma.RssEntrySelect

export type RssEntryAdminRecord = Prisma.RssEntryGetPayload<{ select: typeof rssEntryAdminSelect }>

export function findRssEntryById(id: string) {
  return prisma.rssEntry.findUnique({
    where: { id },
    select: rssEntryAdminSelect,
  })
}

export function listRssEntrySourceOptions() {
  return prisma.rssSource.findMany({
    orderBy: [
      { siteName: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      siteName: true,
    },
  })
}

export function countRssEntriesForAdmin(where: Prisma.RssEntryWhereInput) {
  return prisma.rssEntry.count({ where })
}

export function countRssEntriesByReviewStatus(where: Prisma.RssEntryWhereInput, reviewStatus: RssEntryReviewStatus) {
  return prisma.rssEntry.count({
    where: {
      ...where,
      reviewStatus,
    },
  })
}

export function listRssEntriesPage(where: Prisma.RssEntryWhereInput, skip: number, take: number) {
  return prisma.rssEntry.findMany({
    where,
    orderBy: [
      { publishedAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    skip,
    take,
    select: rssEntryAdminSelect,
  })
}

export function updateRssEntryRecord(id: string, data: Prisma.RssEntryUpdateInput) {
  return prisma.rssEntry.update({
    where: { id },
    data,
    select: rssEntryAdminSelect,
  })
}

export function updateManyRssEntries(where: Prisma.RssEntryWhereInput, data: Prisma.RssEntryUpdateManyMutationInput) {
  return prisma.rssEntry.updateMany({
    where,
    data,
  })
}

export function deleteRssEntryRecord(id: string) {
  return prisma.rssEntry.delete({
    where: { id },
  })
}

export function deleteManyRssEntries(where: Prisma.RssEntryWhereInput) {
  return prisma.rssEntry.deleteMany({
    where,
  })
}
