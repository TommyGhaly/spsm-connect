/**
 * Home — and, for now, the whole of what this app is for.
 *
 * Phase 3 puts the bulletin, the week's schedule and a band of recent
 * photographs above what is here. What is here is the part that cannot wait for
 * that, because it is the reason the app exists and because every line of the
 * upload subsystem was written months before anything called it.
 *
 * The destination is `config/events.mainSection` — the parish's own answer to
 * "what is happening now", the same field the door tag reads. A parishioner at
 * a service does not want to be asked to navigate a tree before they can send
 * the photograph they just took; they want one button, and the parish decides
 * once a season what it means.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label, Lede, Small, Title } from '@/components/Type';
import { resolveMainSection, type MainSection } from '@/gallery/mainSection';
import { mayAdminProgramEvent } from '@/firebase/grants';
import { useGrants } from '@/session/SessionProvider';
import { captureAndQueue, pickAndQueue, type PickOutcome } from '@/upload/pick';
import { useUploads } from '@/upload/useUploads';
import { useTheme } from '@/theme/ThemeProvider';

export default function Home() {
  const theme = useTheme();
  const router = useRouter();
  const grants = useGrants();
  const uploads = useUploads();

  const [section, setSection] = useState<MainSection | null>(null);
  const [resolving, setResolving] = useState(true);
  const [picking, setPicking] = useState(false);
  const [outcome, setOutcome] = useState<PickOutcome | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resolved = await resolveMainSection();
        if (!cancelled) setSection(resolved);
      } catch {
        // Offline, or the ministry was removed. Both read as "nothing set" —
        // see the note at the top of gallery/mainSection.ts.
        if (!cancelled) setSection(null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(
    async (take: boolean) => {
      if (!section) return;
      setPicking(true);
      setOutcome(null);
      try {
        const options = {
          programId: section.programId,
          programEventId: section.programEventId,
          // The higher video ceiling, for somebody who administers this
          // ministry. It was defaulting to false for everybody.
          isProgramAdmin: mayAdminProgramEvent(grants, section.programId, section.programEventId),
        };
        setOutcome(take ? await captureAndQueue(options) : await pickAndQueue(options));
      } finally {
        setPicking(false);
      }
    },
    [grants, section],
  );

  return (
    <Screen>
      <Title>SPSM Connect</Title>

      {resolving ? (
        <Lede color={theme.color.inkSoft}>Finding out what is happening…</Lede>
      ) : section ? (
        <Card gap={theme.space.sm}>
          <Label>Send a photograph to</Label>
          <Body>{section.title}</Body>
          <View style={{ gap: theme.space.xs, marginTop: theme.space.xs }}>
            <Button label="Take a photograph" onPress={() => void send(true)} busy={picking} />
            <Button
              label="Choose from my library"
              onPress={() => void send(false)}
              tone="quiet"
              disabled={picking}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <Label>Photographs</Label>
          {/*
            * Deliberately not an error. Nothing is set, or the ministry it named
            * has gone, or submissions are closed — a parishioner can act on none
            * of those, so all three say the same true thing.
            */}
          <Body color={theme.color.inkSoft}>
            The parish is not collecting photographs at the moment. When it is, this is where you
            will send yours.
          </Body>
        </Card>
      )}

      {outcome && !outcome.cancelled ? <Outcome outcome={outcome} /> : null}

      {uploads.rows.length > 0 ? (
        <Card gap={theme.space.sm}>
          <Label>Sending</Label>
          <Body color={theme.color.inkSoft}>
            {uploads.outstanding > 0
              ? `${uploads.outstanding} still to send.`
              : uploads.failed > 0
                ? `${uploads.failed} did not send.`
                : 'Everything has been sent.'}
          </Body>
          <Button label="See what is sending" onPress={() => router.push('/uploads')} tone="quiet" />
        </Card>
      ) : null}
    </Screen>
  );
}

/**
 * What happened to the batch.
 *
 * Both halves are shown together and that is the point: eleven photographs went
 * and one did not, and a person who is only told about the failure will think
 * none of them went.
 */
function Outcome({ outcome }: { outcome: PickOutcome }) {
  const theme = useTheme();

  return (
    <Card gap={theme.space.xs}>
      {outcome.queued > 0 ? (
        <Body>
          {outcome.queued === 1
            ? 'One photograph is on its way.'
            : `${outcome.queued} photographs are on their way.`}
        </Body>
      ) : null}
      {outcome.refused.map((refusal) => (
        <View key={`${refusal.name}:${refusal.reason}`} style={{ gap: 2 }}>
          <Small color={theme.color.accent}>{refusal.name}</Small>
          {/*
            * `condense`'s own words, verbatim. They name the number the person
            * can act on — trim the clip, and how long is too long.
            */}
          <Small color={theme.color.inkSoft}>{refusal.reason}</Small>
        </View>
      ))}
    </Card>
  );
}
