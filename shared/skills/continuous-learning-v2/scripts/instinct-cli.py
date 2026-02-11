#!/usr/bin/env python3
"""
Instinct CLI - Manage instincts for Continuous Learning v2

Commands:
  status   - Show all instincts and their status
  import   - Import instincts from file or URL
  export   - Export instincts to file
  evolve   - Cluster instincts into skills/commands/agents
"""

import argparse
import json
import os
import sys
import re
import urllib.request
from pathlib import Path
from datetime import datetime
from collections import defaultdict

HOMUNCULUS_DIR = Path.home() / ".claude" / "homunculus"
INSTINCTS_DIR = HOMUNCULUS_DIR / "instincts"
PERSONAL_DIR = INSTINCTS_DIR / "personal"
INHERITED_DIR = INSTINCTS_DIR / "inherited"
EVOLVED_DIR = HOMUNCULUS_DIR / "evolved"
OBSERVATIONS_FILE = HOMUNCULUS_DIR / "observations.jsonl"

for d in [PERSONAL_DIR, INHERITED_DIR, EVOLVED_DIR / "skills", EVOLVED_DIR / "commands", EVOLVED_DIR / "agents"]:
    d.mkdir(parents=True, exist_ok=True)


def parse_instinct_file(content):
    instincts = []
    current = {}
    in_frontmatter = False
    content_lines = []

    for line in content.split('\n'):
        if line.strip() == '---':
            if in_frontmatter:
                in_frontmatter = False
            else:
                in_frontmatter = True
                if current:
                    current['content'] = '\n'.join(content_lines).strip()
                    instincts.append(current)
                current = {}
                content_lines = []
        elif in_frontmatter:
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key == 'confidence':
                    current[key] = float(value)
                else:
                    current[key] = value
        else:
            content_lines.append(line)

    if current:
        current['content'] = '\n'.join(content_lines).strip()
        instincts.append(current)

    return [i for i in instincts if i.get('id')]


def load_all_instincts():
    instincts = []
    for directory in [PERSONAL_DIR, INHERITED_DIR]:
        if not directory.exists():
            continue
        for file in directory.glob("*.yaml"):
            try:
                content = file.read_text(encoding='utf-8')
                parsed = parse_instinct_file(content)
                for inst in parsed:
                    inst['_source_file'] = str(file)
                    inst['_source_type'] = directory.name
                instincts.extend(parsed)
            except Exception as e:
                print(f"Warning: Failed to parse {file}: {e}", file=sys.stderr)
    return instincts


def cmd_status(args):
    instincts = load_all_instincts()
    if not instincts:
        print("No instincts found.")
        print(f"\nInstinct directories:")
        print(f"  Personal:  {PERSONAL_DIR}")
        print(f"  Inherited: {INHERITED_DIR}")
        return

    by_domain = defaultdict(list)
    for inst in instincts:
        by_domain[inst.get('domain', 'general')].append(inst)

    print(f"\n{'='*60}")
    print(f"  INSTINCT STATUS - {len(instincts)} total")
    print(f"{'='*60}\n")

    personal = [i for i in instincts if i.get('_source_type') == 'personal']
    inherited = [i for i in instincts if i.get('_source_type') == 'inherited']
    print(f"  Personal:  {len(personal)}")
    print(f"  Inherited: {len(inherited)}")
    print()

    for domain in sorted(by_domain.keys()):
        domain_instincts = by_domain[domain]
        print(f"## {domain.upper()} ({len(domain_instincts)})")
        print()
        for inst in sorted(domain_instincts, key=lambda x: -x.get('confidence', 0.5)):
            conf = inst.get('confidence', 0.5)
            conf_bar = '#' * int(conf * 10) + '-' * (10 - int(conf * 10))
            print(f"  {conf_bar} {int(conf*100):3d}%  {inst.get('id', 'unnamed')}")
            print(f"            trigger: {inst.get('trigger', 'unknown trigger')}")
            content = inst.get('content', '')
            action_match = re.search(r'## Action\s*\n\s*(.+?)(?:\n\n|\n##|$)', content, re.DOTALL)
            if action_match:
                action = action_match.group(1).strip().split('\n')[0]
                print(f"            action: {action[:60]}{'...' if len(action) > 60 else ''}")
            print()

    if OBSERVATIONS_FILE.exists():
        obs_count = sum(1 for _ in open(OBSERVATIONS_FILE, encoding='utf-8'))
        print(f"  Observations: {obs_count} events logged")
        print(f"  File: {OBSERVATIONS_FILE}")

    print(f"\n{'='*60}\n")


def cmd_evolve(args):
    instincts = load_all_instincts()
    if len(instincts) < 3:
        print("Need at least 3 instincts to analyze patterns.")
        return 1

    print(f"\n{'='*60}")
    print(f"  EVOLVE ANALYSIS - {len(instincts)} instincts")
    print(f"{'='*60}\n")

    by_domain = defaultdict(list)
    for inst in instincts:
        by_domain[inst.get('domain', 'general')].append(inst)

    high_conf = [i for i in instincts if i.get('confidence', 0) >= 0.8]
    print(f"High confidence instincts (>=80%): {len(high_conf)}")

    trigger_clusters = defaultdict(list)
    for inst in instincts:
        trigger = inst.get('trigger', '')
        trigger_key = trigger.lower()
        for keyword in ['when', 'creating', 'writing', 'adding', 'implementing', 'testing']:
            trigger_key = trigger_key.replace(keyword, '').strip()
        trigger_clusters[trigger_key].append(inst)

    skill_candidates = []
    for trigger, cluster in trigger_clusters.items():
        if len(cluster) >= 2:
            avg_conf = sum(i.get('confidence', 0.5) for i in cluster) / len(cluster)
            skill_candidates.append({
                'trigger': trigger, 'instincts': cluster, 'avg_confidence': avg_conf,
                'domains': list(set(i.get('domain', 'general') for i in cluster))
            })

    skill_candidates.sort(key=lambda x: (-len(x['instincts']), -x['avg_confidence']))
    print(f"\nPotential skill clusters found: {len(skill_candidates)}")

    if skill_candidates:
        print(f"\n## SKILL CANDIDATES\n")
        for i, cand in enumerate(skill_candidates[:5], 1):
            print(f"{i}. Cluster: \"{cand['trigger']}\"")
            print(f"   Instincts: {len(cand['instincts'])}, Avg confidence: {cand['avg_confidence']:.0%}")
            for inst in cand['instincts'][:3]:
                print(f"     - {inst.get('id')}")
            print()

    print(f"\n{'='*60}\n")
    return 0


def main():
    parser = argparse.ArgumentParser(description='Instinct CLI for Continuous Learning v2')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    subparsers.add_parser('status', help='Show instinct status')

    import_parser = subparsers.add_parser('import', help='Import instincts')
    import_parser.add_argument('source', help='File path or URL')
    import_parser.add_argument('--dry-run', action='store_true')
    import_parser.add_argument('--force', action='store_true')
    import_parser.add_argument('--min-confidence', type=float)

    export_parser = subparsers.add_parser('export', help='Export instincts')
    export_parser.add_argument('--output', '-o')
    export_parser.add_argument('--domain')
    export_parser.add_argument('--min-confidence', type=float)

    evolve_parser = subparsers.add_parser('evolve', help='Analyze and evolve instincts')
    evolve_parser.add_argument('--generate', action='store_true')

    args = parser.parse_args()

    if args.command == 'status': return cmd_status(args)
    elif args.command == 'evolve': return cmd_evolve(args)
    else: parser.print_help(); return 1


if __name__ == '__main__':
    sys.exit(main() or 0)
