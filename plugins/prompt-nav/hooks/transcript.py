import glob
import json
import os
import sys


def text_of(content):
    if isinstance(content, str):
        return content
    return " ".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")


def main(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if '"type":"user"' not in line and '"queued_command"' not in line:
                continue
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if row.get("isMeta") or row.get("isSidechain"):
                continue
            queued = row.get("attachment") if row.get("type") == "attachment" else None
            if isinstance(queued, dict) and queued.get("type") == "queued_command":
                text = queued.get("prompt")
                if queued.get("commandMode") == "prompt" and isinstance(text, str) and text.strip():
                    out.append({"id": row.get("uuid"), "text": text})
                continue
            if row.get("type") != "user":
                continue
            content = row.get("message", {}).get("content")
            if not isinstance(content, str) and any(
                isinstance(b, dict) and b.get("type") == "tool_result" for b in content or []
            ):
                continue
            text = text_of(content)
            if text.strip():
                out.append({"id": row.get("uuid"), "text": text})
    sys.stdout.write(json.dumps(out))


def resolve(arg):
    if os.path.isfile(arg):
        return arg
    root = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude")
    found = glob.glob(os.path.join(root, "projects", "*", f"{arg}.jsonl"))
    if not found:
        sys.exit(2)
    return max(found, key=os.path.getmtime)


if __name__ == "__main__":
    main(resolve(sys.argv[1]))
