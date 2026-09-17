/**
 * Turning a stream's address into something that starts playing on its own.
 *
 * ---------------------------------------------------------------------------
 * The website's `features/livestream/embed.ts`, with `mute=1` deliberately
 * taken out — and that one missing parameter is the whole difference between
 * the two files, so it is worth saying why rather than letting it read as an
 * oversight.
 *
 * On the web, muting is not a preference. Every current browser refuses to
 * start audio the reader did not ask for, so an `autoplay=1` embed *without*
 * `mute=1` does not autoplay at all — it sits paused, which is the exact state
 * autoplay was added to remove. The website's choice there is not "muted or
 * loud", it is "muted or still stopped", and its own note says so.
 *
 * A `WebView` is not a browser tab. The app sets that policy itself, through
 * `mediaPlaybackRequiresUserAction={false}` on the player — `WKWebView`'s
 * `mediaTypesRequiringUserActionForPlayback = .none` on iOS and
 * `setMediaPlaybackRequiresUserGesture(false)` on Android — and both then allow
 * autoplay *with sound*. So the constraint the website is working around does
 * not exist here, and working around it anyway would mean somebody who
 * opened a screen called "Watch live" gets a silent liturgy and has to hunt for
 * a speaker button inside an embedded player to hear it.
 *
 * The failure if this is ever wrong is mild and self-announcing: a platform
 * that refuses unmuted autoplay leaves the player paused, and the reader
 * presses play once — the same place the website's readers start from. That is
 * the right risk to take for sound on the first frame.
 * ---------------------------------------------------------------------------
 *
 * `playsinline=1` keeps the video in the frame this app drew rather than
 * throwing it into the platform's fullscreen player the moment it starts, which
 * on a screen that also lists the recent services would take the reader
 * somewhere they did not ask to go.
 *
 * `rel=0` narrows what YouTube offers when the broadcast ends: not "no related
 * videos" — YouTube stopped honouring that in 2018 — but at least videos from
 * the church's own channel rather than whatever the algorithm likes today.
 */
const YOUTUBE_AUTOPLAY = 'autoplay=1&playsinline=1&rel=0';

/** A YouTube video id as an embed that starts on its own. */
export function youtubeEmbed(videoId: string): string {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${YOUTUBE_AUTOPLAY}`;
}

/**
 * The same treatment for a URL that already exists.
 *
 * Deliberately does nothing to an address it does not recognise, and that
 * restraint is the website's too. `platform: 'custom'` is a provider's embed
 * URL given verbatim by whoever set the stream up, and appending query
 * parameters to an arbitrary player is as likely to break it as to help — some
 * read an unknown parameter as a malformed request. A stream that plays after
 * one press is a far smaller failure than one that does not play at all.
 *
 * Castr, which is what the church streams through today, falls through
 * untouched: its player autoplays of its own accord once the WebView stops
 * requiring a gesture.
 */
export function withAutoplay(url: string): string {
  if (/^https:\/\/www\.youtube(-nocookie)?\.com\/embed\//.test(url)) {
    return `${url}${url.includes('?') ? '&' : '?'}${YOUTUBE_AUTOPLAY}`;
  }

  // Facebook's plugin takes `autoplay` and has no `mute` parameter to leave
  // out; the player shows its own unmute button when it decides to mute itself.
  if (url.startsWith('https://www.facebook.com/plugins/video.php')) {
    return `${url}${url.includes('?') ? '&' : '?'}autoplay=true`;
  }

  return url;
}

/** Where a past broadcast is watched. */
export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}
