import { describe, expect, it, vi } from "vitest";
import { createNotificationAudio } from "./notificationAudio";

function mediaFixture() {
  const media = {
    paused: true,
    currentTime: 0,
    preload: "",
    volume: 1,
    play: vi.fn(async () => {
      media.paused = false;
    }),
    pause: vi.fn(() => {
      media.paused = true;
    }),
    removeAttribute: vi.fn(),
    load: vi.fn(),
  };
  const factory = vi.fn(() => media as unknown as HTMLAudioElement);
  const onStatus = vi.fn();
  return {
    media,
    factory,
    onStatus,
    player: createNotificationAudio(onStatus, factory),
  };
}
describe("notification audio lifecycle", () => {
  it("lazily allocates one player and reuses it through many polling notifications", async () => {
    const { player, factory, media } = mediaFixture();
    expect(factory).not.toHaveBeenCalled();
    for (let i = 0; i < 100; i++) {
      await player.play();
      media.paused = true;
    }
    expect(factory).toHaveBeenCalledTimes(1);
    expect(media.play).toHaveBeenCalledTimes(100);
    player.dispose();
  });
  it("does not stack or queue sound while a play request or clip is in progress", async () => {
    const { player, media, factory } = mediaFixture();
    let release!: () => void;
    media.play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            media.paused = false;
            resolve();
          };
        }),
    );
    const pending = player.play();
    await Promise.all(Array.from({ length: 30 }, () => player.play()));
    expect(media.play).toHaveBeenCalledTimes(1);
    release();
    await pending;
    await player.play();
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    player.dispose();
  });
  it("catches autoplay rejection and allows a later user-initiated attempt on the same element", async () => {
    const { player, media, factory, onStatus } = mediaFixture();
    media.play.mockRejectedValueOnce(
      new DOMException("Gesture required", "NotAllowedError"),
    );
    await expect(player.play()).resolves.toBeUndefined();
    expect(onStatus).toHaveBeenLastCalledWith("blocked");
    await player.play();
    expect(onStatus).toHaveBeenLastCalledWith("ready");
    expect(factory).toHaveBeenCalledTimes(1);
    player.dispose();
  });
  it("releases the media source on cleanup and ignores late play promises", async () => {
    const { player, media, onStatus, factory } = mediaFixture();
    let reject!: (error: Error) => void;
    media.play.mockImplementationOnce(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    const pending = player.play();
    player.dispose();
    player.dispose();
    reject(new DOMException("Unloaded", "AbortError"));
    await pending;
    await player.play();
    expect(media.pause).toHaveBeenCalledTimes(1);
    expect(media.removeAttribute).toHaveBeenCalledWith("src");
    expect(media.load).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(onStatus).not.toHaveBeenCalled();
  });
  it("mutes immediately and does not restore ready status from an interrupted play", async () => {
    const { player, media, onStatus } = mediaFixture();
    let finish!: () => void;
    media.play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = player.play();
    player.stop();
    finish();
    await pending;
    expect(media.pause).toHaveBeenCalledTimes(1);
    expect(onStatus).not.toHaveBeenCalled();
    player.dispose();
  });
  it("reports a bad source without rejecting the polling path", async () => {
    const { player, media, onStatus } = mediaFixture();
    media.play.mockRejectedValueOnce(new Error("Invalid media"));
    await expect(player.play()).resolves.toBeUndefined();
    expect(onStatus).toHaveBeenLastCalledWith("error");
    player.dispose();
  });
});
