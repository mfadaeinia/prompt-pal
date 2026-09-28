import { describe, expect, it } from "vitest";
import { transcriptReadiness } from "./transcript-readiness";

describe("transcriptReadiness", () => {
  it("short completed transcript is ready", () => {
    expect(transcriptReadiness(2, false)).toBe("ready");
    expect(transcriptReadiness(1, false)).toBe("ready");
  });
  it("non-empty streaming first chunk is partial", () => {
    expect(transcriptReadiness(3, true)).toBe("partial");
  });
  it("empty transcript is failed", () => {
    expect(transcriptReadiness(0, false)).toBe("failed");
    expect(transcriptReadiness(0, true)).toBe("failed");
  });
});
