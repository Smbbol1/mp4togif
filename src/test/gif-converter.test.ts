import { describe, expect, it } from "vitest";
import { validateDuration, validateFile } from "@/lib/gif-converter";

describe("MP4 conversion limits", () => {
  it("accepts MP4 files and rejects other formats", () => {
    expect(validateFile({ name: "clip.MP4", type: "", size: 1 })).toBeUndefined();
    expect(validateFile({ name: "clip.mov", type: "video/quicktime", size: 1 })).toBeTruthy();
  });

  it("accepts at most 100 MB", () => {
    const file = { name: "clip.mp4", type: "video/mp4" };
    expect(validateFile({ ...file, size: 100_000_000 })).toBeUndefined();
    expect(validateFile({ ...file, size: 100_000_001 })).toBeTruthy();
  });

  it("accepts at most 30 seconds", () => {
    expect(validateDuration(30)).toBeUndefined();
    expect(validateDuration(30.01)).toBeTruthy();
  });
});
