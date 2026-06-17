import { describe, it, expect } from "vitest";
import { extractVideoId } from "./transcript-trace.functions";

const ID = "ydKcaIE6O1k";

describe("extractVideoId", () => {
  const cases: Array<[string, string | null]> = [
    [`https://www.youtube.com/watch?v=${ID}`, ID],
    [`https://www.youtube.com/watch?si=l6pZFkI2Iv0VmVGT&v=${ID}&feature=youtu.be`, ID],
    [`https://youtu.be/${ID}`, ID],
    [`https://youtu.be/${ID}?si=abc123`, ID],
    [`https://www.youtube.com/shorts/${ID}`, ID],
    [`https://m.youtube.com/watch?v=${ID}`, ID],
    [`https://youtube.com/watch?v=${ID}`, ID],
    [`https://www.youtube.com/watch?feature=share&v=${ID}&t=10s`, ID],
    [`https://www.youtube.com/embed/${ID}`, ID],
    [`https://www.youtube.com/live/${ID}`, ID],
    [ID, ID],
    [`youtube.com/watch?v=${ID}`, ID],
    // invalid
    ["https://www.youtube.com/watch?v=tooShort", null],
    ["https://example.com/watch?v=" + ID, null],
    ["not a url", null],
    ["", null],
  ];

  for (const [input, expected] of cases) {
    it(`parses: ${input || "<empty>"}`, () => {
      expect(extractVideoId(input)).toBe(expected);
    });
  }
});
