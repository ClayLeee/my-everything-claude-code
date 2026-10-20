import type { On } from "claude-code";
import { expect, mock, test } from "claude-code/testing";

type OnScreen = { first: number; last: number; of: number } | null;

const row = (requestId: string, text: string, onScreen: OnScreen) => ({
  plugin: "prompt-nav",
  surface: "terminal" as const,
  component: "UserMessage" as const,
  requestId,
  props: { text, origin: { kind: "composer" as const }, isExpanded: true, onScreen },
});

const BAND = {
  plugin: "prompt-nav",
  surface: "terminal" as const,
  component: "AbovePrompt" as const,
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 60,
    scroll: { offset: 0, bodyRows: 6, total: 3 },
    view: {},
  },
};

const session = (on: On, texts: string[]) => {
  on("session.messages", () => ({
    value: texts.map((text) => ({ role: "user" as const, text, toolUses: [] })),
  }));
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);
    return <Text>{e.component}</Text>;
  });
  on("classic.SessionStart", () => ({}));
  return mock.clock(on);
};

test("the band names the prompt the transcript shows", async ($, on) => {
  const clock = session(on, ["first ask", "second ask"]);
  await $.ui.mount(row("u1", "first ask", { first: 0, last: 1, of: 2 }));
  await $.ui.mount(row("u2", "second ask", null));
  await clock.advance(200);

  const band = await $.ui.mount(BAND);
  expect(await band.find({ text: "first ask" })).toBeDefined();
  expect(await band.find({ text: "❯ 1/2 " })).toBeDefined();
});

test("the band follows the scroll to the next prompt", async ($, on) => {
  const clock = session(on, ["first ask", "second ask"]);
  await $.ui.mount(row("u1", "first ask", null));
  await $.ui.mount(row("u2", "second ask", { first: 0, last: 1, of: 2 }));
  await clock.advance(200);

  const band = await $.ui.mount(BAND);
  expect(await band.find({ text: "second ask" })).toBeDefined();
  expect(await band.find({ text: "❯ 2/2 " })).toBeDefined();
});

const send = ($: Parameters<Parameters<typeof test>[1]>[0], uuid: string, text: string, door: "prompt" | "attachment") =>
  $.session.append({
    message: { type: door === "prompt" ? "user" : "attachment", content: [{ type: "text", text }] },
    door,
    origin: { kind: "composer" },
    uuid,
  } as never);

// A row pushed off screen by a burst of output, or unmounted, may never report `onScreen: null`,
// so it would stay "on screen" and, being the topmost, keep the band on it.
test("sending a prompt moves the band to it past a row stuck on screen", async ($, on) => {
  const texts = ["first ask"];
  const clock = session(on, texts);
  await $.ui.mount(row("u1", "first ask", { first: 0, last: 1, of: 2 }));
  await clock.advance(200);
  texts.push("second ask");
  await send($, "u2", "second ask", "prompt");
  await clock.advance(200);

  const band = await $.ui.mount(BAND);
  expect(await band.find({ text: "❯ 2/2 " })).toBeDefined();
});

test("a prompt sent mid-turn moves the band to it past a row stuck on screen", async ($, on) => {
  const notice = "The user sent a new message while you were working:\nsent mid-turn\n\nThis is how Claude Code surfaces messages";
  const texts = ["first ask"];
  const clock = session(on, texts);
  await $.ui.mount(row("u1", "first ask", { first: 0, last: 1, of: 2 }));
  await clock.advance(200);
  texts.push("sent mid-turn");
  await send($, "a1", notice, "attachment");
  await clock.advance(200);

  const band = await $.ui.mount(BAND);
  expect(await band.find({ text: "❯ 2/2 " })).toBeDefined();
});

test("the band stays out of the way with no prompts", async ($, on) => {
  const clock = session(on, []);
  await clock.advance(200);

  const band = await $.ui.mount(BAND);
  expect(await band.find({ text: "AbovePrompt" })).toBeDefined();
});

test("the band loads the latest prompt with nothing drawn yet", async ($, on) => {
  const clock = session(on, ["old ask", "latest ask"]);
  const band = await $.ui.mount(BAND);
  await clock.advance(200);

  expect(await band.find({ text: "latest ask" })).toBeDefined();
  expect(await band.find({ text: "❯ 2/2 " })).toBeDefined();
});

test("a resumed session loads its prompts", async ($, on) => {
  const clock = session(on, ["resumed ask"]);
  await $.classic.SessionStart({ source: "resume" });
  await clock.advance(200);

  const band = await $.ui.mount(BAND);
  expect(await band.find({ text: "resumed ask" })).toBeDefined();
});

const PANE = (rows: number) => ({
  plugin: "prompt-nav",
  surface: "terminal" as const,
  component: "Pane" as const,
  requestId: "prompt-nav",
  props: {
    title: "Prompts",
    isFocused: true,
    bodyColumns: 40,
    placement: "dock" as const,
    scroll: { offset: 0, bodyRows: rows, total: rows },
    view: {},
  },
});

test("the pane shows the current prompt in full below the list", async ($, on) => {
  const long = "第一行很長的 prompt 內容，需要換行才能完整顯示出來，最後一句是結尾";
  const clock = session(on, ["short ask", long]);
  await $.ui.mount(BAND);
  await clock.advance(200);

  const pane = await $.ui.mount(PANE(20));
  expect(await pane.find({ key: "full" })).toBeDefined();
  expect((await pane.find({ key: "full" }))?.text).toContain("最後一句是結尾");
});

test("the pane list keeps the current prompt in view above the full box", async ($, on) => {
  const texts = Array.from({ length: 30 }, (_, i) => `ask number ${i + 1}`);
  const clock = session(on, texts);
  await $.ui.mount(BAND);
  await clock.advance(200);

  const pane = await $.ui.mount(PANE(16));
  expect(await pane.find({ key: "p-29" })).toBeDefined();
  expect(await pane.find({ key: "p-0" })).toBeUndefined();
});

test("a prompt never drawn jumps by the id read from the transcript", async ($, on) => {
  const clock = session(on, ["older ask", "newer ask"]);
  on("process.run", () => ({
    value: {
      exitCode: 0,
      stdout: JSON.stringify([
        { id: "t-1", text: "older ask" },
        { id: "t-2", text: "newer ask" },
      ]),
      stderr: "",
      isStdoutTruncated: false,
    },
  }) as never);
  const toasts: string[] = [];
  on("ui.toast", (_$, e) => {
    toasts.push(JSON.stringify(e));
    return {} as never;
  });
  await $.classic.SessionStart({ source: "resume", transcript_path: "C:/t.jsonl" });
  await clock.advance(200);

  const pane = await $.ui.mount(PANE(20));
  const pressed = await pane.press({ key: "p-0" }).then(
    () => "",
    (err: unknown) => String(err),
  );
  expect(pressed).toContain("ui.scroll");
  expect(toasts).toEqual([]);
});

test("a jump keeps the pane on the prompt picked, not one the jump left behind", async ($, on) => {
  const clock = session(on, ["first ask", "second ask"]);
  await $.ui.mount(row("u1", "first ask", { first: 0, last: 1, of: 2 }));
  const second = await $.ui.mount(row("u2", "second ask", null));
  await clock.advance(200);

  const pane = await $.ui.mount(PANE(20));
  await pane.press({ key: "p-1" }).catch(() => undefined);
  await second.redraw(row("u2", "second ask", { first: 0, last: 1, of: 2 }).props);
  await clock.advance(200);

  const band = await $.ui.mount(BAND);
  expect(await band.find({ text: "❯ 2/2 " })).toBeDefined();
});

test("a prompt sent while Claude was working shows up from its tool-result message", async ($, on) => {
  on("session.messages", () => ({
    value: [
      { role: "user" as const, text: "first ask", toolUses: [] },
      {
        role: "user" as const,
        text: "The user sent a new message while you were working:\nsent mid-turn\n\nThis is how Claude Code surfaces messages",
        toolUses: [],
        toolResults: [{ tool_use_id: "t1", text: "ok", isError: false, result: "ok" }],
      },
      {
        role: "user" as const,
        text: "<system-reminder>a hook said hi</system-reminder>",
        toolUses: [],
        toolResults: [{ tool_use_id: "t2", text: "ok", isError: false, result: "ok" }],
      },
    ],
  }));
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);
    return <Text>{e.component}</Text>;
  });
  on("classic.SessionStart", () => ({}));
  const clock = mock.clock(on);
  const band = await $.ui.mount(BAND);
  await clock.advance(200);
  expect(await band.find({ text: "sent mid-turn" })).toBeDefined();
  expect(await band.find({ text: "❯ 2/2 " })).toBeDefined();
});
