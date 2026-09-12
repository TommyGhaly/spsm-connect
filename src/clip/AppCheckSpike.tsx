/**
 * The App Clip spike, and the only screen in the clip until it answers.
 *
 * ## The question
 *
 * Apple's App Attest, used inside an App Clip, produces an attestation **against
 * the parent app's bundle identifier** — `org.spsm.connect` — not the clip's
 * `org.spsm.connect.Clip`. Firebase's SDK builds its App Check request from the
 * bundle it is *running in*. So the two disagree by construction, and that is
 * the likeliest explanation for the long-running "App Check does not work in
 * App Clips" reports.
 *
 * It matters more here than it would in most apps. `galleryUploadUrl` and
 * `formUploadUrl` read the `X-Firebase-AppCheck` header **by hand** — every
 * Function in the Website repo is `onRequest`, not `onCall`, so Firebase's own
 * `enforceAppCheck` never runs — and both answer `401 {"error":"unattested"}`
 * when the header is missing. No token, no photographs and no forms: the two
 * things the clip exists to do.
 *
 * ## What to do with the answer
 *
 * PASS — the clip can upload, and the nine experiences are all buildable.
 *
 * FAIL — the clip cannot write anything. That is not the end of it: a read-only
 * clip (see the gallery, read the schedule, then "Get the app" to send a
 * photograph) is still worth having, and the tags still work for everyone via
 * the website. But it is a different plan, and it is much cheaper to find out
 * here than after nine invocation URLs have been built.
 *
 * ## Why it must run on a real device
 *
 * App Attest refuses a simulator outright. A debug token registered in the
 * Firebase console makes the *simulator* pass while telling you nothing about
 * the real question — a debug provider does not go near App Attest, so it would
 * report PASS for a build that fails in a parishioner's hand. Run this on
 * hardware, in Release. See README.md.
 */
import { useCallback, useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import { ScrollView, View } from 'react-native';

import { ApiError, apiPost } from '@/api/client';
import { Button, Card } from '@/components/Surface';
import { Body, Label, Small, Title } from '@/components/Type';
import { appCheckToken } from '@/firebase/appCheck';
import { uploadIdToken } from '@/firebase/auth';
import { resolveMainSection } from '@/gallery/mainSection';
import { useTheme } from '@/theme/ThemeProvider';

type Verdict = 'running' | 'pass' | 'fail';

interface Check {
  name: string;
  verdict: Verdict;
  detail: string;
}

const RUNNING: Check[] = [
  { name: 'Firebase initialised', verdict: 'running', detail: 'Checking…' },
  { name: 'Anonymous sign-in', verdict: 'running', detail: 'Checking…' },
  { name: 'App Check token', verdict: 'running', detail: 'Checking…' },
];

export function AppCheckSpike() {
  const theme = useTheme();
  const [checks, setChecks] = useState<Check[]>(RUNNING);
  const [reservation, setReservation] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;

    const run = async () => {
      const results: Check[] = [];

      /*
       * 1. Does React Native Firebase come up at all in this target?
       *
       * The clip ships the *parent app's* GoogleService-Info.plist, whose
       * BUNDLE_ID says `org.spsm.connect` while this process is
       * `org.spsm.connect.Clip`. RNFB may refuse that outright, which would be
       * the first and bluntest way this fails.
       */
      try {
        const app = getApp();
        results.push({
          name: 'Firebase initialised',
          verdict: 'pass',
          detail: `${app.name} · ${app.options.projectId ?? 'no project id'}`,
        });
      } catch (error) {
        results.push({
          name: 'Firebase initialised',
          verdict: 'fail',
          detail: messageOf(error),
        });
      }

      /*
       * 2. An anonymous session, which is what attributes an upload for quota.
       *
       * Worth watching separately from App Check: a clip's storage does not
       * survive between invocations the way an installed app's does, so this
       * may mint a fresh anonymous user every single tap. That is not fatal —
       * `galleryUploadUrl` also caps per hashed IP — but it makes the per-uid
       * daily limit useless for clip traffic, which is worth knowing.
       */
      try {
        const token = await uploadIdToken();
        results.push({
          name: 'Anonymous sign-in',
          verdict: 'pass',
          detail: `ID token, ${token.length} characters.`,
        });
      } catch (error) {
        results.push({ name: 'Anonymous sign-in', verdict: 'fail', detail: messageOf(error) });
      }

      /*
       * 3. The question.
       *
       * `appCheckToken()` swallows its own errors and answers null, because the
       * app's upload path wants to turn that into one sentence a parishioner can
       * read. Here null is the finding.
       */
      const attestation = await appCheckToken();
      results.push({
        name: 'App Check token',
        verdict: attestation ? 'pass' : 'fail',
        detail: attestation
          ? `Minted, ${attestation.length} characters.`
          : 'No token. App Attest would not vouch for this clip — see the note at the top of this file.',
      });

      if (live) setChecks(results);
    };

    void run();
    return () => {
      live = false;
    };
  }, []);

  /*
   * The end-to-end proof, behind a button rather than automatic.
   *
   * A successful reservation writes a real `galleryMedia` document against the
   * parish's current main section and spends one of the day's quota. It cleans
   * itself up — `sweepUnuploadedSubmissions` deletes pending rows whose bytes
   * never arrived after an hour — but it is still a write to production, and
   * production writes should be somebody pressing a button rather than a screen
   * appearing.
   */
  const reserve = useCallback(async () => {
    setBusy(true);
    setReservation(null);
    try {
      const section = await resolveMainSection();
      if (!section) {
        setReservation({
          name: 'Reservation',
          verdict: 'fail',
          detail: 'No main section is set, so there is nothing to send to. Set one on /events first.',
        });
        return;
      }

      await apiPost('/api/gallery/upload-url', {
        programId: section.programId,
        programEventId: section.programEventId,
        contentType: 'image/webp',
        byteSize: 1024,
      });

      setReservation({
        name: 'Reservation',
        verdict: 'pass',
        detail: `galleryUploadUrl accepted the clip's attestation, filing to ${section.title}. It will be swept in an hour.`,
      });
    } catch (error) {
      const unattested = error instanceof ApiError && error.code === 'unattested';
      setReservation({
        name: 'Reservation',
        verdict: 'fail',
        detail: unattested
          ? 'Refused: unattested. This is the failure the spike exists to find — the clip cannot upload.'
          : messageOf(error),
      });
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <ScrollView
      style={{ backgroundColor: theme.color.paper }}
      contentContainerStyle={{ padding: theme.space.gutter, gap: theme.space.md }}
    >
      <Title>App Clip spike</Title>
      <Body color={theme.color.inkSoft}>
        Whether Firebase App Check can vouch for this App Clip. Run on a real device, in Release —
        a simulator with a debug token will pass and prove nothing.
      </Body>

      {checks.map((check) => (
        <Result key={check.name} check={check} />
      ))}

      <Card gap={theme.space.sm}>
        <Label>The end-to-end test</Label>
        <Body color={theme.color.inkSoft}>
          Asks galleryUploadUrl for a real reservation. Writes one pending row against the parish&rsquo;s
          current main section, which is swept automatically after an hour.
        </Body>
        <Button label="Try a real reservation" onPress={() => void reserve()} busy={busy} />
      </Card>

      {reservation ? <Result check={reservation} /> : null}
    </ScrollView>
  );
}

function Result({ check }: { check: Check }) {
  const theme = useTheme();

  const colour =
    check.verdict === 'pass'
      ? theme.color.azure
      : check.verdict === 'fail'
        ? theme.color.accent
        : theme.color.inkFaint;

  return (
    <Card gap={theme.space.xs}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.space.sm }}>
        <Label>{check.name}</Label>
        <Label color={colour}>{check.verdict}</Label>
      </View>
      <Small color={theme.color.inkSoft}>{check.detail}</Small>
    </Card>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
