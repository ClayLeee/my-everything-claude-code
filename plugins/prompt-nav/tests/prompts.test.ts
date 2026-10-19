import { expect, test } from "claude-code/testing";

import { bindIds, clipCols, midTurnPrompts, pick, typedPrompt } from "../hooks/prompts";

test("keeps a typed prompt, trimmed", async () => {
  expect(typedPrompt("  fix the header \n")).toBe("fix the header");
});

test("drops rows the person did not type", async () => {
  expect(typedPrompt("<command-name>/cicd</command-name>")).toBeUndefined();
  expect(typedPrompt("<local-command-stdout>ok</local-command-stdout>")).toBeUndefined();
  expect(typedPrompt("<system-reminder>x</system-reminder>")).toBeUndefined();
  expect(typedPrompt("Base directory for this skill: C:/x")).toBeUndefined();
  expect(typedPrompt("   ")).toBeUndefined();
});

test("unwraps a message sent mid-turn", async () => {
  const framed =
    "The user sent a new message while you were working:\n看完要幫我移除\n\nThis is how Claude Code surfaces messages";
  expect(typedPrompt(framed)).toBe("看完要幫我移除");
});

test("finds every prompt sent mid-turn in a tool-result message, and nothing else", async () => {
  const notice = (text: string) =>
    `The user sent a new message while you were working:\n${text}\n\nThis is how Claude Code surfaces messages`;
  expect(midTurnPrompts(`${notice("先停一下")} ${notice("改用 pnpm")}`)).toEqual([
    "先停一下",
    "改用 pnpm",
  ]);
  expect(midTurnPrompts("<system-reminder>file changed</system-reminder>")).toEqual([]);
  expect(midTurnPrompts("")).toEqual([]);
});

test("binds row ids to prompts by order of the same text", async () => {
  const seen = [
    { id: "r3", text: "b" },
    { id: "r1", text: "a" },
    { id: "r4", text: "a" },
  ];
  expect(bindIds(["a", "b", "a", "c"], seen)).toEqual(["r1", "r3", "r4", undefined]);
});

test("picks the topmost prompt on screen", async () => {
  const ids = ["a", "b", "c"];
  expect(pick(ids, new Set(["c", "b"]), undefined, 0)).toBe(1);
});

test("with none on screen, keeps one that left upward and steps back past one that left downward", async () => {
  const ids = ["a", "b", "c"];
  expect(pick(ids, new Set(), { id: "c", wentDown: false }, 2)).toBe(2);
  expect(pick(ids, new Set(), { id: "c", wentDown: true }, 2)).toBe(1);
  expect(pick(ids, new Set(), { id: "a", wentDown: true }, 0)).toBe(0);
  expect(pick(ids, new Set(), undefined, 1)).toBe(1);
});

test("drops the interruption marker", async () => {
  expect(typedPrompt("[Request interrupted by user for tool use]")).toBeUndefined();
  expect(typedPrompt("[Request interrupted by user]")).toBeUndefined();
});

test("clips to one line by display columns, counting CJK as two", async () => {
  expect(clipCols("abc", 5)).toBe("abc");
  expect(clipCols("a  b\nc", 10)).toBe("a b c");
  expect(clipCols("abcdef", 4)).toBe("abc…");
  expect(clipCols("中文字串", 5)).toBe("中文…");
  expect(clipCols("中文", 4)).toBe("中文");
});

test("binds ids even when the two sources join a prompt's text blocks differently", async () => {
  const seen = [{ id: "r1", text: "看這張圖 [Image #1] 怎麼修" }];
  expect(bindIds(["看這張圖[Image #1]怎麼修"], seen)).toEqual(["r1"]);
  expect(bindIds(["看這張圖  [Image #1]\n怎麼修"], seen)).toEqual(["r1"]);
});
