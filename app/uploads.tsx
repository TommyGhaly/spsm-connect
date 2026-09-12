/**
 * What is sending, what failed, and what to do about it.
 *
 * The queue is durable in SQLite, so this screen is a view of a table rather
 * than of anything in memory — close the app mid-batch and everything here is
 * still here on the next launch, which is the whole reason `queue.ts` uses a
 * database instead of an array.
 *
 * The one thing worth knowing before changing it: **a failure is not
 * necessarily worth retrying.** `worthRetrying` says no for 413 (too large,
 * which will be too large again) and 409 (already sent). Offering a Retry on
 * those is offering a button that is guaranteed to fail, so the row shows
 * Remove instead.
 */
import { formatBytes, worthMentioning } from '@spsm/shared';

import { worthRetrying } from '@/upload/errors';
import { View } from 'react-native';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label, Lede, Small } from '@/components/Type';
import { useUploads } from '@/upload/useUploads';
import type { QueueRow } from '@/upload/queue';
import { useTheme } from '@/theme/ThemeProvider';

export default function Uploads() {
  const theme = useTheme();
  const uploads = useUploads();

  if (uploads.loading) {
    return (
      <Screen>
        <Lede color={theme.color.inkSoft}>Reading the queue…</Lede>
      </Screen>
    );
  }

  if (uploads.rows.length === 0) {
    return (
      <Screen>
        <Card>
          <Label>Nothing waiting</Label>
          <Body color={theme.color.inkSoft}>
            Photographs you send appear here until the parish has them.
          </Body>
        </Card>
      </Screen>
    );
  }

  const finished = uploads.rows.filter((row) => row.state === 'done').length;

  return (
    <Screen>
      {uploads.failed > 0 ? (
        <Button label={`Try ${uploads.failed} again`} onPress={() => void uploads.retryAll()} />
      ) : null}

      {uploads.rows.map((row) => (
        <Row key={row.id} row={row} onRetry={() => void uploads.retry(row.id)} onRemove={() => void uploads.remove(row.id)} />
      ))}

      {finished > 0 ? (
        <Button
          label={`Clear ${finished} sent`}
          onPress={() => void uploads.clearFinished()}
          tone="quiet"
        />
      ) : null}
    </Screen>
  );
}

function Row({
  row,
  onRetry,
  onRemove,
}: {
  row: QueueRow;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();

  const noun = row.kind === 'video' ? 'Clip' : 'Photograph';
  const retryable = row.state === 'failed' && retryWorthOffering(row);

  return (
    <Card gap={theme.space.xs}>
      <Label color={row.state === 'failed' ? theme.color.accent : theme.color.inkFaint}>
        {stateLabel(row)}
      </Label>

      <Body>{noun}</Body>

      {/*
        * The "we made this smaller" line, on the same rule the website uses —
        * only when the saving is big enough to be worth a sentence. A parish
        * photograph that went from 9.8MB to 9.6MB is not news.
        */}
      {worthMentioning(row.originalBytes, row.byteSize) ? (
        <Small color={theme.color.inkSoft}>
          Made smaller for sending — {formatBytes(row.originalBytes)} to {formatBytes(row.byteSize)}.
        </Small>
      ) : (
        <Small color={theme.color.inkSoft}>{formatBytes(row.byteSize)}</Small>
      )}

      {row.error ? <Small color={theme.color.inkSoft}>{row.error}</Small> : null}

      {row.state === 'failed' ? (
        <View style={{ flexDirection: 'row', gap: theme.space.xs, marginTop: theme.space.xs }}>
          {retryable ? <View style={{ flex: 1 }}><Button label="Try again" onPress={onRetry} tone="quiet" /></View> : null}
          <View style={{ flex: 1 }}>
            <Button label="Remove" onPress={onRemove} tone="danger" />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function stateLabel(row: QueueRow): string {
  switch (row.state) {
    case 'queued':
      return 'Waiting';
    case 'uploading':
      // `bytesSent` is written from inside the background URLSession callback,
      // so this moves even when the app was not on screen for most of it.
      return row.byteSize > 0
        ? `Sending — ${Math.min(100, Math.round((row.bytesSent / row.byteSize) * 100))}%`
        : 'Sending';
    case 'done':
      return 'Sent';
    case 'failed':
      return 'Did not send';
  }
}

/**
 * Whether this row's failure is one a retry could fix.
 *
 * A null status means the send never reached a server — a dropped connection, a
 * file that could not be read — and those are exactly the failures a second
 * press does fix, so they get the button. A status goes through `worthRetrying`,
 * which withholds it for the two that will answer the same way next time: 413,
 * because the clip really is that large, and 409, because the gallery has
 * stopped taking photographs.
 */
function retryWorthOffering(row: QueueRow): boolean {
  return row.httpStatus === null || worthRetrying(row.httpStatus);
}
