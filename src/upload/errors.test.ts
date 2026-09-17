/**
 * The sentences a failed upload turns into, and the one decision behind them.
 *
 * This module is small enough to look obviously correct and is not: its header
 * records that `worthRetrying` shipped with no caller at all, so the retry
 * button was offered for every failure including the two that can never
 * succeed. These tests exist so that regression is a red run rather than a
 * parishioner tapping "try again" at a 413 until they give up.
 */
import { UNATTESTED, UploadFailure, explainUploadFailure, worthRetrying } from './errors';

describe('explainUploadFailure', () => {
  it('has a sentence for every status it knows about', () => {
    for (const status of [400, 401, 403, 408, 429, 500, 502, 504, 418]) {
      const sentence = explainUploadFailure(status);

      expect(typeof sentence).toBe('string');
      expect(sentence.length).toBeGreaterThan(0);
    }
  });

  it('never shows the reader a status code or an XML body', () => {
    /*
     * These come from storage.googleapis.com, whose body is XML written for a
     * developer. The whole job of this function is that none of that reaches
     * somebody who wanted to send a photograph of a baptism.
     */
    for (const status of [400, 401, 403, 408, 429, 500, 504, 599]) {
      const sentence = explainUploadFailure(status, '<?xml version="1.0"?><Error><Code>x</Code></Error>');

      expect(sentence).not.toMatch(/\d{3}/);
      expect(sentence).not.toMatch(/[<>]/);
    }
  });

  it('tells somebody on a poor signal what is actually wrong', () => {
    expect(explainUploadFailure(408)).toMatch(/signal/i);
    expect(explainUploadFailure(504)).toMatch(/signal/i);
  });

  it('distinguishes an expired slot from a file that changed underneath it', () => {
    // Different causes and different remedies: one is the five-minute signing
    // window closing, the other is the content-length pin.
    expect(explainUploadFailure(403)).not.toBe(explainUploadFailure(400));
    expect(explainUploadFailure(401)).toBe(explainUploadFailure(403));
  });

  it('asks for patience rather than a retry when the church is busy', () => {
    expect(explainUploadFailure(429)).toMatch(/few minutes/i);
  });

  it('falls back to something sayable for a status nobody anticipated', () => {
    expect(explainUploadFailure(418)).toMatch(/could not be sent/i);
    expect(explainUploadFailure(0)).toMatch(/could not be sent/i);
  });
});

describe('worthRetrying', () => {
  it('refuses the two that can never succeed', () => {
    // 413: the clip really is too big, and it will be next time too.
    expect(worthRetrying(413)).toBe(false);
    // 409: the gallery has stopped taking photographs.
    expect(worthRetrying(409)).toBe(false);
  });

  it('allows the ones a second attempt can fix', () => {
    for (const status of [400, 401, 403, 408, 429, 500, 502, 504]) {
      expect(worthRetrying(status)).toBe(true);
    }
  });
});

describe('UploadFailure', () => {
  it('keeps the status beside the sentence', () => {
    /*
     * The reason this class exists. A bare Error carried only the sentence, so
     * by the time a row reached the queue nothing downstream could tell "too
     * large, and will be next time" from "the network dropped".
     */
    const failure = new UploadFailure(413, explainUploadFailure(413));

    expect(failure).toBeInstanceOf(Error);
    expect(failure.status).toBe(413);
    expect(failure.name).toBe('UploadFailure');
    expect(worthRetrying(failure.status)).toBe(false);
  });

  it('is catchable as an ordinary Error', () => {
    expect(() => {
      throw new UploadFailure(500, 'nope');
    }).toThrow(Error);
  });
});

describe('UNATTESTED', () => {
  it('does not suggest a remedy the reader does not have', () => {
    /*
     * App Attest failing is not something a parishioner can fix — it is a
     * simulator, a wrongly signed build, or an unregistered debug token. The
     * message says so and asks them to report it instead of offering a retry.
     */
    expect(UNATTESTED).toMatch(/not something you can fix/i);
    expect(UNATTESTED).not.toMatch(/try again/i);
  });
});
