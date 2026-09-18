/**
 * The one retry in the attestation path, and the failures that must *not* get one.
 *
 * This is here because the bug it covers is invisible from the code that has
 * it. `initializeAppCheck` returns an instance while its native half is still
 * being configured — RNFB's modular wrapper discards that promise — and RNFB
 * fails closed in the gap with `provider-not-ready`. Downstream, a lost race
 * and a refused attestation are the same thing: no header, `401 unattested`, a
 * failed row, and somebody told their photograph could not be sent by an app
 * that would have sent it 200ms later.
 *
 * The other half matters as much. A retry loop that swallowed *every* failure
 * would sit there for a second before reporting an unregistered debug token or
 * an unsupported provider — answers that will be identical on the sixth try —
 * so the second test is not symmetry for its own sake.
 */
const mockGetToken = jest.fn();

jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));

jest.mock('@react-native-firebase/app-check', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
  initializeAppCheck: () => ({}),
  ReactNativeFirebaseAppCheckProvider: class {
    configure() {}
  },
}));

// Required after the mocks, and `require` rather than `import` for that reason:
// an `import` is hoisted above them.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { appCheckToken, appCheckTokenOrReason } = require('./appCheck') as
  typeof import('./appCheck');

/** The rejection RNFB raises before its native provider is configured. */
function notReady(): Error & { code: string } {
  return Object.assign(
    new Error('App Check provider is not ready. Call initializeAppCheck before requesting tokens.'),
    { code: 'appCheck/provider-not-ready' },
  );
}

beforeEach(() => {
  mockGetToken.mockReset();
});

describe('appCheckTokenOrReason', () => {
  it('waits out a provider that is not configured yet', async () => {
    mockGetToken
      .mockRejectedValueOnce(notReady())
      .mockRejectedValueOnce(notReady())
      .mockResolvedValueOnce({ token: 'attested' });

    await expect(appCheckTokenOrReason()).resolves.toEqual({ ok: true, token: 'attested' });
    expect(mockGetToken).toHaveBeenCalledTimes(3);
  });

  it('gives up if it never becomes ready, rather than waiting forever', async () => {
    mockGetToken.mockRejectedValue(notReady());

    const attempt = await appCheckTokenOrReason();

    expect(attempt.ok).toBe(false);
    // Bounded. The exact ceiling is NOT_READY_ATTEMPTS + the first go.
    expect(mockGetToken.mock.calls.length).toBeLessThanOrEqual(7);
    expect(mockGetToken.mock.calls.length).toBeGreaterThan(1);
  });

  it('reports an answer that will not change on the second try, at once', async () => {
    mockGetToken.mockRejectedValue(
      Object.assign(new Error('unsupported attestation provider'), { code: 'app-check/unknown' }),
    );

    const attempt = await appCheckTokenOrReason();

    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(attempt).toEqual({
      ok: false,
      // The code and the message both, because the description is where the
      // useful half of an RNFB failure actually lives.
      reason: 'app-check/unknown — unsupported attestation provider',
    });
  });

  it('treats a token-less success as a failure with words for it', async () => {
    mockGetToken.mockResolvedValue(null);

    await expect(appCheckTokenOrReason()).resolves.toEqual({
      ok: false,
      reason: 'The SDK returned no token and no error.',
    });
  });
});

describe('appCheckToken', () => {
  it('hands back the token when there is one', async () => {
    mockGetToken.mockResolvedValue({ token: 'attested' });

    await expect(appCheckToken()).resolves.toBe('attested');
  });

  /*
   * Null rather than a throw is the contract every caller is written against:
   * `postHeaders` simply omits the header, and the endpoint's own `unattested`
   * refusal is what gets shown. The warning is the development half of that —
   * a null here fails every upload, and the reason must not be silent while
   * somebody is building the thing.
   */
  it('answers null and names the reason in development', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetToken.mockRejectedValue(
      Object.assign(new Error('unsupported attestation provider'), { code: 'app-check/unknown' }),
    );

    await expect(appCheckToken()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unsupported attestation provider'));

    warn.mockRestore();
  });
});
