/**
 * The upload queue, on disk.
 *
 * The website's submission flow lives entirely in a React component: pick,
 * prepare, send, and if the tab closes the batch is gone. That is a reasonable
 * trade in a browser and a poor one on a phone, where the person who has just
 * selected sixty photographs of a camp will lock the screen and put it in a
 * pocket. So the queue is SQLite, and the uploader reads from it rather than
 * from component state.
 *
 * THE STALENESS RULE, which is the trap in this feature:
 *
 *   A signed URL lives 5 minutes (URL_TTL_MS in functions/src/galleries/uploadUrl.ts).
 *   `sweepUnuploadedSubmissions` deletes any galleryMedia document still
 *   `pending` with `sourceUploaded == false` after ONE HOUR.
 *
 * So an entry that sits overnight on a dead connection has had its document
 * swept, and sending its bytes now would land an object in Storage that no
 * document points at — invisible to the review queue, and billed forever. An
 * entry older than STALE_AFTER_MS therefore throws away its reservation and
 * mints a fresh one. Never resume against an expired reservation.
 */
import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * How long a minted reservation may sit before it is re-minted.
 *
 * Ten minutes inside the Function's one-hour sweep. The margin covers a slow
 * upload that started in good faith and a clock that disagrees slightly; going
 * closer to the hour would occasionally lose a file to a race nobody can debug.
 */
export const STALE_AFTER_MS = 50 * 60 * 1000;

export type QueueState = 'queued' | 'uploading' | 'done' | 'failed';

export interface QueueRow {
  id: string;
  localUri: string;
  contentType: string;
  byteSize: number;
  originalBytes: number;
  kind: 'photo' | 'video';
  programId: string;
  programEventId: string;
  state: QueueState;
  attempts: number;
  /** Null until a reservation is minted; cleared again when one goes stale. */
  mediaId: string | null;
  uploadUrl: string | null;
  /** When the reservation was minted, for the staleness rule above. */
  mintedAt: number | null;
  bytesSent: number;
  error: string | null;
  /**
   * The HTTP status of the last failure, when there was one.
   *
   * Null for a row that has not failed, and also for one that failed without
   * ever reaching a server. `worthRetrying` in ./errors.ts reads this to decide
   * whether to offer the button — a 413 or a 409 will answer the same way next
   * time, and a retry that cannot succeed is worse than no retry at all.
   */
  httpStatus: number | null;
  createdAt: number;
}

let database: SQLiteDatabase | null = null;

async function db(): Promise<SQLiteDatabase> {
  if (database) return database;
  database = await openDatabaseAsync('spsm-uploads.db');
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY NOT NULL,
      localUri TEXT NOT NULL,
      contentType TEXT NOT NULL,
      byteSize INTEGER NOT NULL,
      originalBytes INTEGER NOT NULL,
      kind TEXT NOT NULL,
      programId TEXT NOT NULL,
      programEventId TEXT NOT NULL,
      state TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      mediaId TEXT,
      uploadUrl TEXT,
      mintedAt INTEGER,
      bytesSent INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      httpStatus INTEGER,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS uploads_state ON uploads (state, createdAt);
  `);

  /*
   * `CREATE TABLE IF NOT EXISTS` does nothing to a table that already exists,
   * so a device that ran an earlier build has the old shape and no `httpStatus`.
   * SQLite has no `ADD COLUMN IF NOT EXISTS`, and the app is unreleased, so the
   * cheapest correct thing is to try and ignore the duplicate-column error.
   *
   * If this file ever needs a second migration, that is the moment to stop doing
   * it this way and keep a version number instead.
   */
  try {
    await database.execAsync(`ALTER TABLE uploads ADD COLUMN httpStatus INTEGER`);
  } catch {
    // Already there. Every other reason this could fail would have failed above.
  }

  return database;
}

export async function enqueue(
  item: Omit<
    QueueRow,
    | 'id'
    | 'state'
    | 'attempts'
    | 'mediaId'
    | 'uploadUrl'
    | 'mintedAt'
    | 'bytesSent'
    | 'error'
    | 'httpStatus'
    | 'createdAt'
  >,
): Promise<string> {
  const id = randomUUID();
  const handle = await db();
  await handle.runAsync(
    `INSERT INTO uploads
       (id, localUri, contentType, byteSize, originalBytes, kind, programId, programEventId,
        state, attempts, bytesSent, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, 0, ?)`,
    [
      id,
      item.localUri,
      item.contentType,
      item.byteSize,
      item.originalBytes,
      item.kind,
      item.programId,
      item.programEventId,
      Date.now(),
    ],
  );
  return id;
}

/** Everything still in flight, oldest first — the order they were picked in. */
export async function pending(): Promise<QueueRow[]> {
  const handle = await db();
  return handle.getAllAsync<QueueRow>(
    `SELECT * FROM uploads WHERE state IN ('queued', 'uploading', 'failed') ORDER BY createdAt ASC`,
  );
}

export async function allRows(): Promise<QueueRow[]> {
  const handle = await db();
  return handle.getAllAsync<QueueRow>(`SELECT * FROM uploads ORDER BY createdAt ASC`);
}

/**
 * The next item to send, with any stale reservation already cleared.
 *
 * Sequential by design — one file at a time, matching the website. Parallel
 * uploads from a phone on church-hall wifi make every one of them slower and
 * make the progress display a lie.
 */
export async function nextReady(): Promise<QueueRow | null> {
  const handle = await db();
  const row = await handle.getFirstAsync<QueueRow>(
    `SELECT * FROM uploads WHERE state IN ('queued', 'uploading') ORDER BY createdAt ASC LIMIT 1`,
  );
  if (!row) return null;

  if (row.mintedAt !== null && Date.now() - row.mintedAt > STALE_AFTER_MS) {
    await clearReservation(row.id);
    return { ...row, mediaId: null, uploadUrl: null, mintedAt: null, bytesSent: 0 };
  }
  return row;
}

/**
 * Forget a reservation whose document the sweep has taken.
 *
 * The mediaId is dropped rather than reused: the next mint writes a *new*
 * galleryMedia document, and pointing at the old one would mean uploading to an
 * object path whose document no longer exists.
 */
export async function clearReservation(id: string): Promise<void> {
  const handle = await db();
  await handle.runAsync(
    `UPDATE uploads SET mediaId = NULL, uploadUrl = NULL, mintedAt = NULL, bytesSent = 0 WHERE id = ?`,
    [id],
  );
}

export async function saveReservation(
  id: string,
  reservation: { mediaId: string; uploadUrl: string },
): Promise<void> {
  const handle = await db();
  await handle.runAsync(
    `UPDATE uploads SET mediaId = ?, uploadUrl = ?, mintedAt = ?, state = 'uploading' WHERE id = ?`,
    [reservation.mediaId, reservation.uploadUrl, Date.now(), id],
  );
}

export async function recordProgress(id: string, bytesSent: number): Promise<void> {
  const handle = await db();
  await handle.runAsync(`UPDATE uploads SET bytesSent = ? WHERE id = ?`, [bytesSent, id]);
}

export async function markDone(id: string): Promise<void> {
  const handle = await db();
  await handle.runAsync(`UPDATE uploads SET state = 'done', error = NULL WHERE id = ?`, [id]);
}

export async function markFailed(
  id: string,
  message: string,
  /** Null when the failure never reached a server. See `QueueRow.httpStatus`. */
  httpStatus: number | null = null,
): Promise<void> {
  const handle = await db();
  await handle.runAsync(
    `UPDATE uploads
       SET state = 'failed', error = ?, httpStatus = ?, attempts = attempts + 1
     WHERE id = ?`,
    [message, httpStatus, id],
  );
}

/** Put a failed item back in line, with its reservation dropped. */
export async function retry(id: string): Promise<void> {
  const handle = await db();
  await handle.runAsync(
    `UPDATE uploads
       SET state = 'queued', error = NULL, httpStatus = NULL, mediaId = NULL,
           uploadUrl = NULL, mintedAt = NULL, bytesSent = 0
     WHERE id = ?`,
    [id],
  );
}

export async function retryAll(): Promise<void> {
  const handle = await db();
  await handle.runAsync(
    `UPDATE uploads
       SET state = 'queued', error = NULL, httpStatus = NULL, mediaId = NULL,
           uploadUrl = NULL, mintedAt = NULL, bytesSent = 0
     WHERE state = 'failed'`,
  );
}

export async function remove(id: string): Promise<void> {
  const handle = await db();
  await handle.runAsync(`DELETE FROM uploads WHERE id = ?`, [id]);
}

/** Tidy finished rows. The bytes are the church's now, not the phone's. */
export async function clearFinished(): Promise<void> {
  const handle = await db();
  await handle.runAsync(`DELETE FROM uploads WHERE state = 'done'`);
}
