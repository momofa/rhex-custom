export async function processInBatches<T>(
  items: readonly T[],
  batchSize: number,
  worker: (item: T) => Promise<unknown>,
) {
  const normalizedBatchSize = Math.max(1, Math.floor(batchSize) || 1)

  for (let index = 0; index < items.length; index += normalizedBatchSize) {
    const batch = items.slice(index, index + normalizedBatchSize)
    await Promise.all(batch.map((item) => worker(item)))
  }
}
