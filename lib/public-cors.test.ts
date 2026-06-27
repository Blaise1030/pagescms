import { describe, expect, it } from "vitest";
import { PUBLIC_CORS_HEADERS } from "./public-cors";

describe("PUBLIC_CORS_HEADERS", () => {
  it("allows any origin for public widget endpoints", () => {
    expect(PUBLIC_CORS_HEADERS).toMatchObject({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
  });
});
