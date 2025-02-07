import { describe, expect, test } from "bun:test";
import { char, string, alt, seq } from "../src";

describe("Core Parsers", () => {
  test("char parser", () => {
    expect(char("a")("abc", 0)).toMatchObject({ success: true, value: "a" });
    expect(char("a")("bac", 0)).toMatchObject({ success: false });
  });

  test("string parser", () => {
    expect(string("hello")("hello world", 0)).toMatchObject({
      success: true,
      value: "hello",
    });
  });
});

describe("Combinators", () => {
  test("alt chooses first successful parser", () => {
    const parser = alt(char("a"), char("b"));
    expect(parser("abc", 0)).toMatchObject({ value: "a" });
    expect(parser("bac", 0)).toMatchObject({ value: "b" });
  });

  test("seq combines parsers sequentially", () => {
    const parser = seq(char("a"), char("b"));
    expect(parser("abc", 0)).toMatchObject({ value: ["a", "b"] });
  });
});
