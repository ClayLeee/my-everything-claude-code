import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { Prompt } from "../types";
import {
  bindIds,
  clipCols,
  midTurnPrompts,
  pick,
  typedPrompt,
  widthOf,
} from "./prompts";
import type { Left, Seen } from "./prompts";

type $ = EngineInterface;

const PANE = "prompt-nav";
const PANE_COLUMNS = 46;
const prompts = atom({ plugin: "prompt-nav", key: "prompts" } as const, [] as Prompt[]);
const current = atom({ plugin: "prompt-nav", key: "current" } as const, null as number | null);
const query = atom({ plugin: "prompt-nav", key: "query" } as const, "");

const seen: Seen[] = [];
const shown = new Map<string, { first: number; last: number; of: number }>();
let left: Left | undefined;
const pending: Partial<Record<"refresh" | "follow", { cancel: () => void }>> = {};
let triedAt = -Infinity;

const flat = (text: string) => text.replace(/\s+/g, " ").trim();

async function follow($: $) {
  const list = await read($, prompts);
  const before = await read($, current);
  const next = pick(
    list.map((p) => p.id),
    new Set(shown.keys()),
    left,
    before ?? (list.length ? list.length - 1 : null),
  );
  if (next !== before) await update($, current, () => next);
}

async function refresh($: $) {
  const texts = (await $.session.messages())
    .filter((m) => m.role === "user")
    .flatMap((m) => {
      if (m.toolResults?.length) return midTurnPrompts(m.text);
      const text = typedPrompt(m.text);
      return text === undefined ? [] : [text];
    });
  const ids = bindIds(texts, seen);
  const list = texts.map((text, i) => ({ text, id: ids[i] }));
  const old = await read($, prompts);
  const same =
    old.length === list.length &&
    old.every((p, i) => p.text === list[i]!.text && p.id === list[i]!.id);
  if (!same) await update($, prompts, () => list);
  await follow($);
}

async function loadTranscript($: $, path: string): Promise<boolean> {
  const script = `${$.plugin.root}/hooks/transcript.py`;
  for (const python of ["python", "python3"]) {
    try {
      const r = await $.process.run([python, "-I", script, path], { timeoutMs: 15000 });
      if (r.exitCode !== 0) continue;
      const rows = JSON.parse(r.stdout) as { id: string; text: string }[];
      const fromFile: Seen[] = [];
      for (const row of rows) {
        const text = typedPrompt(row.text);
        if (text !== undefined && row.id) fromFile.push({ id: row.id, text });
      }
      const ids = new Set(fromFile.map((s) => s.id));
      seen.splice(0, seen.length, ...fromFile, ...seen.filter((s) => !ids.has(s.id)));
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

function later($: $, job: "refresh" | "follow") {
  pending[job]?.cancel();
  pending[job] = $.clock.after(50, () => void (job === "refresh" ? refresh($) : follow($)));
}

async function jump($: $, p: Prompt, i: number) {
  if (!p.id) {
    $.ui.toast("這則還沒在畫面上出現過，先往上捲到它附近再跳");
    return;
  }
  pending.follow?.cancel();
  shown.clear();
  shown.set(p.id, { first: 0, last: 0, of: 1 });
  left = undefined;
  await update($, current, () => i);
  const moved = await $.ui.scroll({ to: { requestId: p.id }, block: "start" });
  if (moved.deny !== undefined) $.ui.toast(`無法跳轉：${moved.deny}`);
}

export const register: Register = (on) => {
  seen.length = 0;
  shown.clear();
  left = undefined;
  pending.refresh = pending.follow = undefined;
  triedAt = -Infinity;

  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "prompts",
      description:
        "Toggle a pane of the prompts you sent; press one to jump to it. /prompts reload re-reads the transcript",
    });
    for (const p of await read($, prompts))
      if (p.id && !seen.some((s) => s.id === p.id)) seen.push({ id: p.id, text: p.text });
    later($, "refresh");
    return next(e);
  });

  on("classic.SessionStart", async ($, e, next) => {
    seen.length = 0;
    shown.clear();
    left = undefined;
    await update($, current, () => null);
    if (e.transcript_path) await loadTranscript($, e.transcript_path);
    later($, "refresh");
    return next(e);
  });

  on("command.run", { command: "prompts" }, async ($, e) => {
    if (e.args.trim() === "reload") {
      shown.clear();
      left = undefined;
      const loaded = await loadTranscript($, await $.session.id());
      await refresh($);
      const list = await read($, prompts);
      const ready = list.filter((p) => p.id).length;
      return {
        text: loaded
          ? `Prompts reloaded: ${ready}/${list.length} can jump.`
          : "Prompts refreshed, but the transcript could not be read.",
      };
    }
    if ((await $.ui.panes()).some((p) => p.id === PANE)) {
      await $.ui.close({ id: PANE });
      return { text: "Prompt pane closed." };
    }
    await update($, query, () => "");
    await refresh($);
    await $.ui.open({
      id: PANE,
      title: "Prompts",
      columns: PANE_COLUMNS,
      focus: true,
    });
    const at = await read($, current);
    // Only a convenience: a pane that cannot scroll yet still opens.
    if (at !== null)
      await $.ui.scroll({ in: PANE, to: { key: `r-${at}` }, block: "center" }).catch(() => undefined);
    return { text: "Prompt pane opened." };
  });

  on("session.append", async ($, e, next) => {
    const stored = await next(e);
    const typed = e.door === "prompt" || e.door === "delivery";
    if (e.agentId === undefined && (typed || e.door === "attachment")) {
      if (stored.deny === undefined) {
        const body = stored.message.content.map((b) => (b.type === "text" ? b.text : "")).join(" ");
        const typedText = typed ? typedPrompt(body) : undefined;
        const texts = typedText !== undefined ? [typedText] : midTurnPrompts(body);
        for (const text of texts)
          if (!seen.some((s) => s.id === stored.uuid)) seen.push({ id: stored.uuid, text });
        // Sending brings the transcript back to the bottom. A row pushed off by a burst of output
        // or unmounted may never have said `onScreen: null`, and as the topmost "shown" it would
        // hold the band; start over at the newest prompt and let the rows on screen report again.
        if (texts.length > 0) {
          shown.clear();
          left = undefined;
          await update($, current, () => null);
        }
      }
      later($, "refresh");
    }
    return stored;
  });

  on("ui.render", { component: "UserMessage" }, ($, e, next) => {
    const text = typedPrompt(e.props.text);
    if (text !== undefined && e.props.onScreen !== undefined) {
      const id = e.requestId;
      const isNew = !seen.some((s) => s.id === id);
      if (isNew) seen.push({ id, text });
      const was = shown.get(id);
      const now = e.props.onScreen;
      if (now === null) {
        if (was) left = { id, wentDown: was.first === 0 && was.last < was.of - 1 };
        shown.delete(id);
      } else {
        shown.set(id, { first: now.first, last: now.last, of: now.of });
      }
      if (isNew) later($, "refresh");
      else if (Boolean(was) !== (now !== null)) later($, "follow");
    }
    return next(e);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const list = await read($, prompts);
    const i = await read($, current);
    const p = i === null ? undefined : list[i];
    if (!p) {
      const now = await $.clock.now();
      if (now - triedAt > 2000) {
        triedAt = now;
        later($, "refresh");
      }
    }
    if (e.props.hasSurvey || !p) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    return (
      <Box borderStyle="round" borderColor="#9399b2" paddingX={1}>
        <Text wrap="truncate-end">
          <Text color="claude">{`❯ ${i! + 1}/${list.length} `}</Text>
          <Text>{flat(p.text)}</Text>
        </Text>
      </Box>
    );
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e);
    const { Box, Text, Button } = ui;
    const Input = "Input" in ui ? ui.Input : undefined;
    const list = await read($, prompts);
    const at = await read($, current);
    const q = (await read($, query)).toLowerCase();
    const columns = e.props.bodyColumns ?? 44;
    const room = Math.max(10, columns - 7);
    const bodyRows = e.props.scroll?.bodyRows ?? 24;
    const picked = at === null ? undefined : list[at];
    const textRows = picked
      ? picked.text
          .split("\n")
          .reduce(
            (n, line) => n + Math.max(1, Math.ceil(widthOf(`#${at! + 1} ${line}`) / (columns - 4))),
            0,
          )
      : 0;
    const fullLines = Math.min(textRows, Math.max(3, Math.floor(bodyRows * 0.4)));
    // Every prompt is drawn, so the tree outgrows the pane and the arrow keys scroll it.
    const rows = list.map((p, i) => ({ p, i })).filter(({ p }) => p.text.toLowerCase().includes(q));
    return (
      <Box flexDirection="column">
        {Input && (
          <Box
            key="search-box"
            flexShrink={0}
            borderStyle="round"
            borderColor="#9399b2"
            paddingX={1}
            marginBottom={1}
          >
            <Input
              key="search"
              label="Search"
              placeholder="filter prompts"
              onInput={(v: string) => void update($, query, () => v)}
              onSubmit={(v: string) => void update($, query, () => v)}
            />
          </Box>
        )}
        {picked && (
          <Box
            key="full"
            flexDirection="column"
            flexShrink={0}
            borderStyle="round"
            borderColor="claude"
            paddingX={1}
            marginBottom={1}
            height={fullLines + 2}
            overflow="hidden"
          >
            <Text wrap="wrap">
              <Text color="claude">{`#${at! + 1} `}</Text>
              {picked.text}
            </Text>
          </Box>
        )}
        {list.length === 0 && <Text dimColor>No prompts yet.</Text>}
        {rows.map(({ p, i }) => (
          <Box key={`r-${i}`} flexDirection="row">
            <Box flexShrink={0}>
              <Text
                color={i === at ? "claude" : "subtle"}
              >{`${String(i + 1).padStart(3)} ${i === at ? "●" : "·"} `}</Text>
            </Box>
            <Button
              key={`p-${i}`}
              plain
              dimColor={!p.id}
              hover={{ color: "claude" }}
              autoFocus={i === at ? true : undefined}
              label={clipCols(p.text, room)}
              onPress={() => jump($, p, i)}
            />
          </Box>
        ))}
      </Box>
    );
  });
};
