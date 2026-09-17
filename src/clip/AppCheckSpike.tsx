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
 * PASS — the clip can upload, and all eight experiences are shippable.
 *
 * FAIL — `/c/forms` and `/c/photos` cannot write, and those two experiences do
 * not get registered. The other six write nothing and are unaffected: the
 * schedule, the tour, the plans, the apps list, giving and the bookstore card
 * are all reads or handoffs. A read-only clip is still worth having, and every
 * tag still works for everyone through the fallback page on the website.
 *
 * ## Why it must run on a real device
 *
 * App Attest refuses a simulator outright. A debug token registered in the
 * Firebase console makes the *simulator* pass while telling you nothing about
 * the real question — a debug provider does not go near App Attest, so it would
 * report PASS for a build that fails in somebody's hand. Run this on hardware,
 * in Release, invoked at the unregistered URL `/c/appcheck` — `ClipRoot`
 * recognises it, nothing is registered against it in App Store Connect, and it
 * is printed on nothing. See README.md for the rest of the procedure.
 */
import { useCallback, useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import { ScrollView, View } from 'react-native';

import { ApiError, apiPost } from '@/api/client';
import { Button, Card } from '@/components/Surface';
import { Body, Label, Small, Title } from '@/components/Type';
import { appCheckTokenOrReason } from '@/firebase/appCheck';
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
          /*
           * The Firebase app's own bundle id is printed beside the project,
           * because it is half of the disagreement this spike is about: this
           * says `org.spsm.connect` while the process running it is
           * `org.spsm.connect.Clip`, and seeing both on one screen is what
           * turns the theory into an observation.
           */
          detail:
            `${app.name} · ${app.options.projectId ?? 'no project id'}` +
            ` · plist bundle ${app.options.iosBundleId ?? 'unknown'}`,
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
       * app's upload path wants to turn that into one sentence somebody can
       * read. Here null is the finding.
       */
      const attestation = await appCheckTokenOrReason();
      results.push({
        name: 'App Check token',
        verdict: attestation.ok ? 'pass' : 'fail',
        detail: attestation.ok
          ? `Minted, ${attestation.token.length} characters.`
          : attestation.reason,
      });

      /*
       * What the failure means, spelled out on the screen.
       *
       * The point of coming here with a device at all is to leave with a
       * decision, and a raw SDK error does not make one. `appCheckTokenOrReason`
       * exists so this line can be written; its header has the full account of
       * the three outcomes.
       */
      if (!attestation.ok) {
        const unsupported = /unsupported|not supported|isSupported/i.test(attestation.reason);
        results.push({
          name: 'What that means',
          verdict: 'fail',
          detail: unsupported
            ? 'App Attest is not available inside an App Clip at all. No Firebase configuration ' +
              'changes this: /c/forms and /c/photos cannot write, and the clip ships read-only.'
            : 'App Attest ran, and the exchange was refused — which is what a bundle identifier ' +
              'disagreement looks like. The clip attests as org.spsm.connect.Clip while the plist ' +
              'it ships names org.spsm.connect. Worth trying: a second Firebase iOS app for the ' +
              'clip’s own bundle id, its own GoogleService-Info.plist, and App Attest registered ' +
              'for it.',
        });
      }

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
   * church's current main section and spends one of the day's quota. It cleans
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
          Asks galleryUploadUrl for a real reservation. Writes one pending row against the church&rsquo;s
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
