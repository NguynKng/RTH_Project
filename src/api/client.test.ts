import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, get } from "./client";
const fetchMock = vi.fn();
describe("resilient API client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("HELPDESK_URL", "https://helpdesk.test");
    vi.stubEnv("HELPDESK_TOKEN", "test-only");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("honors Retry-After on 429 and then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('{"error":"busy"}', {
          status: 429,
          headers: { "Retry-After": "2" },
        }),
      )
      .mockResolvedValueOnce(new Response('{"ok":true}'));
    const result = get("/v1/sites");
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ ok: true });
  });
  it("retries 5xx at most four attempts", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('{"error":"busy"}', { status: 500 })),
    );
    const result = get("/v1/staff");
    const assertion = expect(result).rejects.toBeInstanceOf(ApiError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("does not retry a 404", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":"missing"}', { status: 404 }),
    );
    await expect(get("/v1/requests/999")).rejects.toMatchObject({
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("cancels a retry wait immediately on a range change", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":"busy"}', {
        status: 429,
        headers: { "Retry-After": "30" },
      }),
    );
    const controller = new AbortController(),
      result = get("/v1/requests", {}, controller.signal);
    const assertion = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("never exceeds two concurrent requests for one endpoint", async () => {
    let active = 0,
      maximum = 0;
    fetchMock.mockImplementation(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active--;
      return new Response('{"data":[]}');
    });
    const result = Promise.all(
      Array.from({ length: 6 }, (_, page) => get("/v1/requests", { page })),
    );
    await vi.runAllTimersAsync();
    await result;
    expect(maximum).toBe(2);
  });
});
