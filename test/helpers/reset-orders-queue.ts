import type { Queue, Worker } from 'bullmq';

/** Limpa a fila sem corrida com o worker Nest (evita "Missing key for job …"). */
export async function resetOrdersQueue(
  queue: Queue,
  worker: Worker,
): Promise<void> {
  await worker.pause();
  await queue.pause();
  await queue.obliterate({ force: true });
  await queue.resume();
  await worker.resume();
}
