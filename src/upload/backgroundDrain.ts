/**
 * Finishing an upload after the person has put the phone down.
 *
 * There are two separate mechanisms here and it is worth being clear which does
 * the work, because the weaker one is the more visible:
 *
 *   1. **The real one.** `uploader.ts` sends bytes with expo-file-system's
 *      `UploadTask` at `sessionType: 'background'` — an iOS background
 *      URLSession. Once a PUT has started, the OS carries it to completion on
 *      its own whether or not this app is running. Nothing here is involved.
 *
 *   2. **This file.** A periodic wake-up that calls `drainQueue()` so the
 *      *next* item gets its turn. It matters for the case (1) does not cover:
 *      a batch of twenty photographs where the app was closed after the third,
 *      so items four through twenty have no reservation and no in-flight
 *      request for the OS to carry.
 *
 * Do not expect promptness from (2). `expo-background-task` is scheduled by
 * WorkManager on Android and BGTaskScheduler on iOS; the floor is 15 minutes
 * and the real interval is whatever the OS decides based on how the person uses
 * the app. It is a safety net for a queue that would otherwise sit until the
 * next launch, not a transfer mechanism.
 *
 * It is also **unavailable on the iOS simulator**, so the only honest way to
 * test this is a real device — the same constraint App Attest already puts on
 * every upload.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { pending } from './queue';
import { drainQueue } from './uploader';

export const DRAIN_TASK = 'spsm.upload.drain';

/*
 * Defined at module scope, which is a requirement rather than a style: the OS
 * launches the app straight into the task with no UI, and `defineTask` has to
 * have already run by the time the runtime looks for the handler. That is why
 * this module is imported for its side effect in app/_layout.tsx and not
 * lazily where it is used.
 */
TaskManager.defineTask(DRAIN_TASK, async () => {
  try {
    await drainQueue();
    /*
     * Unregister once the queue is empty. Left registered, this wakes the app
     * on a schedule forever to discover there is nothing to do — a battery cost
     * paid by every parishioner who ever sent one photograph. `syncDrainTask`
     * puts it back the moment something is enqueued.
     */
    if ((await pending()).length === 0) await stopDrainTask();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    /*
     * `Failed` rather than a rethrow. The queue is durable and every row keeps
     * its own error and attempt count, so there is nothing to salvage here that
     * is not already on disk — and an unhandled throw out of a headless task is
     * a crash in a process the person cannot see.
     */
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register or unregister the wake-up to match whether there is work.
 *
 * Call after enqueuing and after a drain. Both directions are idempotent, so it
 * is safe to call on every queue change.
 */
export async function syncDrainTask(): Promise<void> {
  const outstanding = (await pending()).length > 0;
  if (outstanding) await startDrainTask();
  else await stopDrainTask();
}

async function startDrainTask(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(DRAIN_TASK)) return;
    // The documented floor. Asking for less does not get less.
    await BackgroundTask.registerTaskAsync(DRAIN_TASK, { minimumInterval: 15 });
  } catch {
    /*
     * Simulator, or an OS that has decided this app may not run in the
     * background. Neither is worth a word to the person: the queue still drains
     * on the next foreground, which is what happens today with no task at all.
     */
  }
}

async function stopDrainTask(): Promise<void> {
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(DRAIN_TASK))) return;
    await BackgroundTask.unregisterTaskAsync(DRAIN_TASK);
  } catch {
    // Never registered, or already gone. Either way there is nothing to stop.
  }
}
