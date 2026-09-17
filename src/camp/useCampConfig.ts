/**
 * The camp's settings, for the two public things that need them.
 *
 * `config/camp` is world-readable — that is deliberate, and it is what lets the
 * forms hub decide whether to advertise the camp without asking anybody to sign
 * in. The website splits this in two (`useCampAdmin` for the back office,
 * `useCampSignUp` for the hub's yes/no) because the first also pays for a
 * `members/{uid}` read. Neither of these does, so here it is one listener with
 * a narrow wrapper over it.
 *
 * A live subscription rather than a read: the sign-up closes mid-season, and a
 * form that carries on taking people because the phone has an old copy of the
 * settings is the failure worth avoiding.
 */
import { useEffect, useState } from 'react';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOC_CAMP,
  parseCampConfig,
  type CampConfig,
} from '@spsm/shared';

export interface CampSettings {
  /** False until the first snapshot, so nothing is drawn from the defaults. */
  ready: boolean;
  config: CampConfig;
}

export function useCampConfig(): CampSettings {
  const [settings, setSettings] = useState<CampSettings>(() => ({
    ready: false,
    config: parseCampConfig(undefined),
  }));

  useEffect(() => {
    return onSnapshot(
      doc(getFirestore(), COLLECTIONS.config, CONFIG_DOC_CAMP),
      (snapshot) => {
        // A missing document is a camp nobody has configured, not an error:
        // `parseCampConfig` fills every field from its own defaults.
        setSettings({ ready: true, config: parseCampConfig(snapshot.data()) });
      },
      (error) => {
        /*
         * Ready, with the defaults. The alternative is a screen that says
         * "loading" forever on a phone with no signal, and the defaults are
         * honest about what they do not know — an empty `weekStarts` draws no
         * weeks rather than the wrong ones.
         */
        console.warn('[camp] could not read the camp settings', error);
        setSettings({ ready: true, config: parseCampConfig(undefined) });
      },
    );
  }, []);

  return settings;
}

/**
 * Whether the camp is taking servant sign-ups, for the forms hub.
 *
 * **It opens `true` and only ever closes on a document that says so.** A hub
 * that hides the sign-up while Firestore is still answering is a hub that
 * flickers, and one that hides it because the read *failed* has taken the form
 * away on exactly the connection least able to go looking for it another way.
 * Closed is a decision somebody made in the camp's settings; it is never an
 * absence — which is why this reads `ready` as "open" rather than waiting.
 */
export function useCampSignUpOpen(): boolean {
  const { ready, config } = useCampConfig();
  return ready ? config.servantSignUp : true;
}
