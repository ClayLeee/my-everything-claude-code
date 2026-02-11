#!/bin/bash
# my-everything-claude-code setup script
# Copies Claude Code configs to target project directory
# Skills are linked via Windows junctions (not copied)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$SCRIPT_DIR/shared"

usage() {
  echo "Usage: $0 <framework> <target-project-path> [--hooks-only]"
  echo ""
  echo "Frameworks:"
  ls -d "$SCRIPT_DIR"/*/  2>/dev/null | xargs -I{} basename {} | grep -v -E '.git|shared'
  echo ""
  echo "Options:"
  echo "  --hooks-only   Only deploy shared hooks (no framework agents)"
  echo ""
  echo "Examples:"
  echo "  $0 vue3 /c/Users/claylee/Documents/devops-ui-v3"
  echo "  $0 --hooks-only /c/Users/claylee/Documents/some-project"
  exit 1
}

# Convert MSYS path to Windows path for mklink
to_win_path() {
  cygpath -w "$1" 2>/dev/null || echo "$1" | sed 's|^/c/|C:\\|; s|/|\\|g'
}

# Create a Windows junction (directory symlink that doesn't need admin)
create_junction() {
  local source="$1"  # what to link to (the real directory)
  local target="$2"  # where the junction appears

  local win_source
  local win_target
  win_source="$(to_win_path "$source")"
  win_target="$(to_win_path "$target")"

  # Remove existing junction/directory
  if [ -L "$target" ] || [ -d "$target" ]; then
    cmd //c "rmdir $win_target" 2>/dev/null || rm -rf "$target"
  fi

  cmd //c "mklink /J $win_target $win_source" > /dev/null 2>&1
}

deploy_shared() {
  local target="$1"

  # Copy hook scripts
  if [ -d "$SHARED_DIR/scripts" ]; then
    mkdir -p "$target/.claude/scripts/hooks"
    mkdir -p "$target/.claude/scripts/lib"
    mkdir -p "$target/.claude/commands"
    cp -r "$SHARED_DIR/scripts/hooks/"* "$target/.claude/scripts/hooks/" 2>/dev/null && \
      echo "  Copied scripts/hooks/" || true
    cp -r "$SHARED_DIR/scripts/lib/"* "$target/.claude/scripts/lib/" 2>/dev/null && \
      echo "  Copied scripts/lib/" || true
  fi

  # Copy shared commands
  if [ -d "$SHARED_DIR/commands" ]; then
    cp -r "$SHARED_DIR/commands/"* "$target/.claude/commands/" 2>/dev/null && \
      echo "  Copied shared commands/" || true
  fi

  # Link skills via Windows junction
  if [ -d "$SHARED_DIR/skills" ]; then
    mkdir -p "$target/.claude/skills"
    for skill_dir in "$SHARED_DIR/skills"/*/; do
      local skill_name
      skill_name="$(basename "$skill_dir")"
      create_junction "$skill_dir" "$target/.claude/skills/$skill_name" && \
        echo "  Linked skills/$skill_name/ -> shared (junction)" || \
        echo "  FAILED to link skills/$skill_name/"
    done
  fi

  # Merge or copy settings.local.json
  if [ -f "$SHARED_DIR/settings.local.json" ]; then
    if [ -f "$target/.claude/settings.local.json" ]; then
      echo "  SKIPPED settings.local.json (already exists, merge manually)"
    else
      cp "$SHARED_DIR/settings.local.json" "$target/.claude/settings.local.json"
      echo "  Copied settings.local.json"
    fi
  fi
}

deploy_framework() {
  local source="$1"
  local target="$2"

  # Copy agents
  if [ -d "$source/agents" ]; then
    mkdir -p "$target/.claude/agents"
    cp -r "$source/agents/"* "$target/.claude/agents/" 2>/dev/null && \
      echo "  Copied agents/" || true
  fi

  # Copy commands
  if [ -d "$source/commands" ]; then
    mkdir -p "$target/.claude/commands"
    cp -r "$source/commands/"* "$target/.claude/commands/" 2>/dev/null && \
      echo "  Copied commands/" || true
  fi
}

# Handle --hooks-only mode
if [ "$1" = "--hooks-only" ]; then
  TARGET="$2"
  if [ -z "$TARGET" ]; then
    usage
  fi
  if [ ! -d "$TARGET" ]; then
    echo "Error: Target directory '$TARGET' does not exist"
    exit 1
  fi
  echo "Deploying shared hooks to $TARGET..."
  deploy_shared "$TARGET"
  echo ""
  echo "Done! Shared hooks deployed to $TARGET"
  exit 0
fi

# Normal mode: framework + hooks
if [ -z "$1" ] || [ -z "$2" ]; then
  usage
fi

FRAMEWORK="$1"
TARGET="$2"
SOURCE="$SCRIPT_DIR/$FRAMEWORK"

if [ ! -d "$SOURCE" ]; then
  echo "Error: Framework '$FRAMEWORK' not found in $SCRIPT_DIR"
  usage
fi

if [ ! -d "$TARGET" ]; then
  echo "Error: Target directory '$TARGET' does not exist"
  exit 1
fi

echo "Deploying '$FRAMEWORK' configs to $TARGET..."
deploy_framework "$SOURCE" "$TARGET"

echo ""
echo "Deploying shared hooks..."
deploy_shared "$TARGET"

echo ""
echo "Done! Claude Code configs for '$FRAMEWORK' deployed to $TARGET"
