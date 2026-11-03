export type NotificationAudioStatus = "idle" | "ready" | "blocked" | "error";
const SOUND_URL = "/sounds/sound-msg.mp3";

/** One lazily-created media element per mounted owner. No AudioContexts,
 * decoded-buffer cache, object URLs, playback queue or retry timers. */
export function createNotificationAudio(
  onStatus: (status: NotificationAudioStatus) => void,
  factory: () => HTMLAudioElement = () => new Audio(SOUND_URL),
) {
  let audio: HTMLAudioElement | null = null;
  let disposed = false;
  let starting = false;
  let generation = 0;

  async function play() {
    if (disposed || starting || (audio && !audio.paused)) return;
    const attempt = ++generation;
    starting = true;
    try {
      if (!audio) {
        audio = factory();
        audio.preload = "auto";
        audio.volume = 0.7;
      }
      audio.currentTime = 0;
      await audio.play();
      if (!disposed && attempt === generation) onStatus("ready");
    } catch (error) {
      if (!disposed && attempt === generation) {
        onStatus(
          error &&
            typeof error === "object" &&
            "name" in error &&
            error.name === "NotAllowedError"
            ? "blocked"
            : "error",
        );
      }
    } finally {
      if (attempt === generation) starting = false;
    }
  }
  function stop() {
    generation++;
    starting = false;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    if (audio) {
      audio.removeAttribute("src");
      audio.load();
      audio = null;
    }
  }
  return { play, stop, dispose };
}
