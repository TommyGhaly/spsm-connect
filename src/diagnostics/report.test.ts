/**
 * The crash reporter's own tests, and they are mostly about restraint.
 *
 * What can go wrong here is not "it fails to write a document" — that shows up
 * the first time anybody looks at the `faults` collection. It is the two
 * failures that are invisible in exactly the situation this code exists for:
 *
 *   - **It throws while reporting**, turning one broken screen into a broken
 *     app at the moment the app is least able to cope.
 *   - **It writes without limit**, so a render loop fills the collection with
 *     one bug and the next real fault is buried.
 *
 * Both are tested here against a fake Firestore, because both are silent.
 */
import { reportFault, watchForFaults } from './report';

/*
 * The Firestore SDK, replaced wholesale. `addDoc` is the only thing the module
 * under test actually calls, and every document it is handed is kept so the
 * assertions can look at the shape as well as the count.
 *
 * `serverTimestamp` returns a sentinel rather than a date because that is what
 * the real one does — the value is resolved on the server — and a test that
 * expected a Date here would be asserting something untrue about the SDK.
 */
/*
 * Named `mock*` because jest requires it: the `jest.mock` factory below is
 * hoisted above these declarations, and jest refuses a factory that closes over
 * anything not prefixed this way rather than letting it read an uninitialised
 * variable at hoist time.
 */
const mockWritten: Record<string, unknown>[] = [];
let mockAddDocBehaviour: 'ok' | 'throw' = 'ok';

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (_db: unknown, name: string) => ({ name }),
  serverTimestamp: () => '__serverTimestamp__',
  addDoc: jest.fn(async (_collection: unknown, doc: Record<string, unknown>) => {
    if (mockAddDocBehaviour === 'throw') throw new Error('permission-denied');
    mockWritten.push(doc);
    return { id: `fault-${mockWritten.length}` };
  }),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

/*
 * Every test gets a module registry of its own.
 *
 * `report.ts` holds the deduplication set and the ceiling counter at module
 * scope — deliberately, because they are per-process — so without this the
 * second test in the file would inherit the first test's "already sent" state
 * and pass or fail depending on the order they happen to run in.
 */
beforeEach(() => {
  mockWritten.length = 0;
  mockAddDocBehaviour = 'ok';
  jest.resetModules();
});

/**
 * The nth document written, or a failure that says so.
 *
 * `noUncheckedIndexedAccess` is on, so `mockWritten[0]` is possibly undefined
 * and every assertion below would need a `?.` — which is exactly the wrong
 * shape for a test, because `expect(undefined?.route).toBe('/')` passes for a
 * reporter that wrote nothing at all.
 */
function fault(at = 0): Record<string, unknown> {
  const doc = mockWritten[at];
  if (!doc) throw new Error(`expected a fault at index ${at}; ${mockWritten.length} were written`);
  return doc;
}

/*
 * A reporter with its counters back at zero.
 *
 * `require` rather than `import()`: jest runs these as CommonJS, where a
 * dynamic import needs --experimental-vm-modules, and the point here is only to
 * re-evaluate the module after `jest.resetModules()` — which is exactly what a
 * fresh `require` does.
 */
async function freshReporter(): Promise<typeof reportFault> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./report') as typeof import('./report')).reportFault;
}

describe('reportFault', () => {
  it('writes one document carrying the error, the source and the route', async () => {
    const report = await freshReporter();
    const wrote = await report(new Error('boom'), 'render', '/calendar');

    expect(wrote).toBe(true);
    expect(mockWritten).toHaveLength(1);
    expect(fault()).toMatchObject({
      message: 'boom',
      source: 'render',
      route: '/calendar',
      version: '1.0.0',
    });
    expect(typeof fault().stack).toBe('string');
  });

  it('never identifies the person', async () => {
    /*
     * `freshReporter` rather than the module-scope import, and every test here
     * does the same: the deduplication set lives at module scope on purpose, so
     * a test reusing the original instance sees the *previous* test's faults
     * already sent and silently writes nothing.
     */
    const report = await freshReporter();
    await report(new Error('boom'), 'render', '/giving');

    /*
     * The privacy notice's claim, as a test. A uid, an email or a device id
     * appearing in this document would make the `faults` collection a log of
     * who used the app and when, which the notice says plainly does not exist.
     */
    const keys = Object.keys(fault());
    expect(keys).toEqual(
      expect.arrayContaining(['message', 'stack', 'source', 'route', 'platform', 'version', 'dev']),
    );
    expect(keys).not.toEqual(expect.arrayContaining(['uid', 'user', 'email', 'device', 'visitor']));
  });

  it('reports the same fault once, however many times it is caught', async () => {
    const report = await freshReporter();

    await report(new Error('same'), 'render', '/calendar');
    await report(new Error('same'), 'render', '/calendar');
    await report(new Error('same'), 'render', '/calendar');

    // A route that throws on every mount re-renders, and the boundary catches
    // each time. One bug is one document.
    expect(mockWritten).toHaveLength(1);
  });

  it('still reports a different fault from the same screen', async () => {
    const report = await freshReporter();

    await report(new Error('first'), 'render', '/calendar');
    await report(new Error('second'), 'render', '/calendar');

    expect(mockWritten).toHaveLength(2);
  });

  it('stops after a ceiling, so a throwing render loop cannot fill the collection', async () => {
    const report = await freshReporter();

    // Each message is unique, so deduplication does not apply and only the
    // ceiling can stop this.
    for (let n = 0; n < 200; n += 1) {
      await report(new Error(`unique ${n}`), 'handler', '/calendar');
    }

    expect(mockWritten.length).toBeLessThanOrEqual(20);
  });

  it('drops a fault with nothing to say rather than having the rule refuse it', async () => {
    const report = await freshReporter();

    expect(await report(new Error(''), 'render', '/calendar')).toBe(false);
    expect(await report(undefined, 'render', '/calendar')).toBe(false);
    expect(await report(null, 'render', '/calendar')).toBe(false);
    expect(mockWritten).toHaveLength(0);
  });

  it('survives a thrown value that is not an Error', async () => {
    const report = await freshReporter();

    // A rejected promise carries whatever it was rejected with, which is
    // routinely a string, a number, or a whole response object.
    await report('a bare string', 'handler', '/forms');
    await report(42, 'handler', '/forms');
    await report({ status: 500 }, 'handler', '/forms');

    expect(mockWritten).toHaveLength(3);
    expect(fault(0).message).toBe('a bare string');
    expect(fault(1).message).toBe('42');
  });

  it('resolves false instead of throwing when the write is refused', async () => {
    const report = await freshReporter();
    mockAddDocBehaviour = 'throw';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // The whole point: a reporter that throws while reporting a crash makes
    // the crash worse. This must not reject.
    await expect(report(new Error('boom'), 'render', '/calendar')).resolves.toBe(false);

    warn.mockRestore();
  });

  it('defaults an empty route to a path rather than an empty string', async () => {
    const report = await freshReporter();
    await report(new Error('boom'), 'handler', '');

    // The rule requires a string; an empty one would be refused and invisible.
    expect(fault().route).toBe('/');
  });
});

describe('watchForFaults', () => {
  it('reports through the global handler and still calls the previous one', async () => {
    const previous = jest.fn();
    const handlers: { current?: (error: unknown, isFatal?: boolean) => void } = {};

    (globalThis as Record<string, unknown>).ErrorUtils = {
      getGlobalHandler: () => previous,
      setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => {
        handlers.current = handler;
      },
    };

    const restore = watchForFaults(() => '/bookstore');
    handlers.current?.(new Error('unhandled'), true);

    // The previous handler is what shows the red screen in development and
    // reports to the platform in release. Wrapping it, never replacing it.
    expect(previous).toHaveBeenCalled();

    restore();
    delete (globalThis as Record<string, unknown>).ErrorUtils;
  });

  it('is a no-op where ErrorUtils does not exist', () => {
    delete (globalThis as Record<string, unknown>).ErrorUtils;

    expect(() => watchForFaults(() => '/')()).not.toThrow();
  });

  it('files a fault against the screen that is open now, not the one at startup', async () => {
    const handlers: { current?: (error: unknown, isFatal?: boolean) => void } = {};
    (globalThis as Record<string, unknown>).ErrorUtils = {
      getGlobalHandler: () => jest.fn(),
      setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => {
        handlers.current = handler;
      },
    };

    // The handler is installed once and outlives every screen, so the route has
    // to be read at the moment of the fault rather than closed over.
    let route = '/';
    const restore = watchForFaults(() => route);
    route = '/forms/summer-camp';

    handlers.current?.(new Error('later'), false);
    await new Promise((resolve) => setImmediate(resolve));

    expect(fault().route).toBe('/forms/summer-camp');

    restore();
    delete (globalThis as Record<string, unknown>).ErrorUtils;
  });
});
