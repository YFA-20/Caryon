import { describe, expect, it } from "vitest";
import { bytesEqual, concatBytes, fromBase64Url, toBase64Url } from "@/lib/crypto/bytes";

describe("bytes (base64url)", () => {
  it("encode puis décode de manière réversible", () => {
    const original = new Uint8Array([0, 1, 2, 250, 251, 255, 66, 127]);
    const encoded = toBase64Url(original);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(fromBase64Url(encoded)).toEqual(original);
  });

  it("gère les tableaux vides", () => {
    expect(toBase64Url(new Uint8Array(0))).toBe("");
    expect(fromBase64Url("")).toEqual(new Uint8Array(0));
  });
});

describe("concatBytes / bytesEqual", () => {
  it("concatène dans l'ordre", () => {
    const out = concatBytes(new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5]));
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5]);
  });

  it("bytesEqual est constant-time et correct", () => {
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(bytesEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});
