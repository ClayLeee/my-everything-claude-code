const NOT_TYPED =
  /^(<(command-(name|message|args)|local-command-[a-z]+|bash-(input|stdout|stderr)|task-notification|system-reminder)>|Base directory for this skill: |\[Request interrupted by user)/;

const MID_TURN =
  /new message while you were working:\s*([\s\S]*?)\s*(?:\n\s*(?:IMPORTANT:|This is how Claude Code)|<\/system-reminder>|$)/;

// Prompts sent while Claude was working ride along in a tool-result message, one notice each.
export function midTurnPrompts(text: string): string[] {
  return [...text.matchAll(new RegExp(MID_TURN.source, "g"))]
    .map((m) => (m[1] ?? "").replace(/<\/?system-reminder>/g, "").trim())
    .filter(Boolean);
}

export function typedPrompt(text: string): string | undefined {
  const sent = text.match(MID_TURN)?.[1];
  const words = (sent ?? text).replace(/<\/?system-reminder>/g, "").trim();
  if (!words || (sent === undefined && NOT_TYPED.test(text.trim()))) return undefined;
  return words;
}

export type Seen = { id: string; text: string };

export function bindIds(texts: readonly string[], seen: readonly Seen[]): (string | undefined)[] {
  const pools = new Map<string, string[]>();
  const key = (t: string) => t.replace(/\s+/g, "");
  for (const s of seen) pools.set(key(s.text), [...(pools.get(key(s.text)) ?? []), s.id]);
  return texts.map((t) => pools.get(key(t))?.shift());
}

export type Left = { id: string; wentDown: boolean };

export function pick(
  ids: readonly (string | undefined)[],
  shown: ReadonlySet<string>,
  left: Left | undefined,
  previous: number | null,
): number | null {
  const top = ids.findIndex((id) => id !== undefined && shown.has(id));
  if (top !== -1) return top;
  const i = left ? ids.indexOf(left.id) : -1;
  if (i === -1) return previous;
  return left!.wentDown ? Math.max(0, i - 1) : i;
}

const wide = (ch: string) => {
  const c = ch.codePointAt(0) ?? 0;
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1faff) ||
    (c >= 0x20000 && c <= 0x3fffd)
  );
};

const cols = (ch: string) => (wide(ch) ? 2 : 1);

export function clipCols(text: string, room: number): string {
  const chars = [...text.replace(/\s+/g, " ").trim()];
  if (chars.reduce((n, ch) => n + cols(ch), 0) <= room) return chars.join("");
  let used = 1;
  let out = "";
  for (const ch of chars) {
    if (used + cols(ch) > room) break;
    used += cols(ch);
    out += ch;
  }
  return `${out}…`;
}

export function widthOf(text: string): number {
  return [...text].reduce((n, ch) => n + cols(ch), 0);
}

export function windowAround(count: number, at: number, size: number): [number, number] {
  if (count <= size) return [0, count];
  const start = Math.min(Math.max(0, at - Math.floor(size / 2)), count - size);
  return [start, start + size];
}
