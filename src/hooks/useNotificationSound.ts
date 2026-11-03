import { useEffect, useRef, useState } from "react";
import { useNotificationStore } from "../data/notifications";
import {
  createNotificationAudio,
  type NotificationAudioStatus,
} from "../lib/notificationAudio";

export function useNotificationSound() {
  const enabled = useNotificationStore((state) => state.soundEnabled);
  const [status, setStatus] = useState<NotificationAudioStatus>("idle");
  const player = useRef<ReturnType<typeof createNotificationAudio> | null>(
    null,
  );
  useEffect(() => {
    const audio = createNotificationAudio(setStatus);
    player.current = audio;
    const unsubscribe = useNotificationStore.subscribe((state, previous) => {
      if (!state.soundEnabled) audio.stop();
      else if (state.serial !== previous.serial) void audio.play();
    });
    return () => {
      unsubscribe();
      audio.dispose();
      player.current = null;
    };
  }, []);
  function toggle() {
    const mute = enabled && status === "ready";
    useNotificationStore.getState().setSoundEnabled(!mute);
    if (mute) {
      player.current?.stop();
      setStatus("idle");
    } else {
      void player.current?.play();
    }
  }
  return { enabled, status, toggle };
}
