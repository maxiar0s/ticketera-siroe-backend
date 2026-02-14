#!/usr/bin/env bash

# Sync skill metadata to AGENTS.md Auto-invoke sections
# Usage: ./skills/skill-sync/assets/sync.sh [--dry-run] [--scope <scope>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Support both legacy `skills/` and current `.agents/skills/` layouts.
SKILL_DIR_CANDIDATES=(
  "$REPO_ROOT/skills"
  "$REPO_ROOT/.agents/skills"
)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DRY_RUN=false
FILTER_SCOPE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --scope)
      FILTER_SCOPE="${2:-}"
      if [[ -z "$FILTER_SCOPE" ]]; then
        echo -e "${RED}Missing value for --scope${NC}"
        exit 1
      fi
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--scope <scope>]"
      echo ""
      echo "Options:"
      echo "  --dry-run    Show what would change without modifying files"
      echo "  --scope      Only sync specific scope (root, ui, api, sdk)"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

get_agents_path() {
  local scope="$1"
  case "$scope" in
    root) echo "$REPO_ROOT/AGENTS.md" ;;
    ui) echo "$REPO_ROOT/ui/AGENTS.md" ;;
    api) echo "$REPO_ROOT/api/AGENTS.md" ;;
    sdk) echo "$REPO_ROOT/prowler/AGENTS.md" ;;
    *) echo "" ;;
  esac
}

extract_field() {
  local file="$1"
  local field="$2"
  awk -v field="$field" '
    /^---$/ { in_frontmatter = !in_frontmatter; next }
    in_frontmatter && $1 == field":" {
      sub(/^[^:]+:[[:space:]]*/, "")
      gsub(/^"|"$/, "")
      gsub(/^\x27|\x27$/, "")
      print
      exit
    }
  ' "$file"
}

extract_metadata() {
  local file="$1"
  local field="$2"
  awk -v field="$field" '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }

    /^---$/ { in_frontmatter = !in_frontmatter; next }
    in_frontmatter && /^metadata:/ { in_metadata = 1; next }
    in_frontmatter && in_metadata && /^[^[:space:]]/ { in_metadata = 0 }

    in_frontmatter && in_metadata {
      line = $0
      sub(/^[[:space:]]+/, "", line)
      if (line ~ ("^" field ":[[:space:]]*")) {
        sub(("^" field ":[[:space:]]*"), "", line)
        if (line != "") {
          val = trim(line)
          gsub(/^"|"$/, "", val)
          gsub(/^\x27|\x27$/, "", val)
          gsub(/^\[|\]$/, "", val)
          print val
          exit
        }

        out = ""
        while (getline) {
          if ($0 ~ /^---$/) break
          l = $0
          if (l ~ /^[[:space:]]*-[[:space:]]*/) {
            sub(/^[[:space:]]*-[[:space:]]*/, "", l)
            l = trim(l)
            gsub(/^"|"$/, "", l)
            gsub(/^\x27|\x27$/, "", l)
            if (l != "") {
              if (out == "") out = l
              else out = out "|" l
            }
          } else {
            break
          }
        }
        if (out != "") print out
        exit
      }
    }
  ' "$file"
}

echo -e "${BLUE}Skill Sync - Updating AGENTS.md Auto-invoke sections${NC}"
echo "========================================================"
echo ""

declare -A SCOPE_SKILLS
declare -a SKILL_FILES

for dir in "${SKILL_DIR_CANDIDATES[@]}"; do
  if [[ -d "$dir" ]]; then
    while IFS= read -r f; do
      SKILL_FILES+=("$f")
    done < <(find "$dir" -mindepth 2 -maxdepth 2 -name SKILL.md -print)
  fi
done

IFS=$'\n' SKILL_FILES_SORTED=($(printf "%s\n" "${SKILL_FILES[@]}" | awk 'NF' | sort -u))
unset IFS

for skill_file in "${SKILL_FILES_SORTED[@]}"; do
  [[ -f "$skill_file" ]] || continue

  skill_name="$(extract_field "$skill_file" "name")"
  scope_raw="$(extract_metadata "$skill_file" "scope")"
  auto_invoke_raw="$(extract_metadata "$skill_file" "auto_invoke")"
  auto_invoke="${auto_invoke_raw//|/;;}"

  if [[ -z "$scope_raw" || -z "$auto_invoke" ]]; then
    continue
  fi

  scope_clean="${scope_raw#[}"
  scope_clean="${scope_clean%]}"
  IFS=',' read -ra scopes <<< "$scope_clean"
  for s in "${scopes[@]}"; do
    scope="$(echo "$s" | xargs)"
    [[ -z "$scope" ]] && continue

    if [[ -n "$FILTER_SCOPE" && "$scope" != "$FILTER_SCOPE" ]]; then
      continue
    fi

    if [[ -z "${SCOPE_SKILLS[$scope]:-}" ]]; then
      SCOPE_SKILLS[$scope]="$skill_name:$auto_invoke"
    else
      SCOPE_SKILLS[$scope]="${SCOPE_SKILLS[$scope]}|$skill_name:$auto_invoke"
    fi
  done
done

IFS=$'\n' scopes_sorted=($(printf "%s\n" "${!SCOPE_SKILLS[@]}" | awk 'NF' | sort))
unset IFS

for scope in "${scopes_sorted[@]}"; do
  agents_path="$(get_agents_path "$scope")"
  if [[ -z "$agents_path" || ! -f "$agents_path" ]]; then
    echo -e "${YELLOW}Warning: No AGENTS.md found for scope '$scope'${NC}"
    continue
  fi

  echo -e "${BLUE}Processing: $scope -> $agents_path${NC}"

  auto_invoke_section="### Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action | Skill |
|--------|-------|"

  rows=()
  IFS='|' read -ra skill_entries <<< "${SCOPE_SKILLS[$scope]}"
  for entry in "${skill_entries[@]}"; do
    skill_name="${entry%%:*}"
    actions_raw="${entry#*:}"
    actions_raw="${actions_raw//;;/|}"
    IFS='|' read -ra actions <<< "$actions_raw"
    for action in "${actions[@]}"; do
      action="$(echo "$action" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
      [[ -z "$action" ]] && continue
      rows+=("$action	$skill_name")
    done
  done

  while IFS=$'\t' read -r action skill_name; do
    [[ -z "$action" ]] && continue
    auto_invoke_section="$auto_invoke_section
| $action | \`$skill_name\` |"
  done < <(printf "%s\n" "${rows[@]}" | LC_ALL=C sort -t $'\t' -k1,1 -k2,2)

  if $DRY_RUN; then
    echo -e "${YELLOW}[DRY RUN] Would update $agents_path with:${NC}"
    echo "$auto_invoke_section"
    echo ""
    continue
  fi

  section_file="$(mktemp)"
  printf "%s\n" "$auto_invoke_section" > "$section_file"

  if grep -q "^### Auto-invoke Skills" "$agents_path"; then
    awk '
      BEGIN { skip = 0 }
      /^### Auto-invoke Skills$/ {
        while ((getline line < "'"$section_file"'") > 0) print line
        close("'"$section_file"'")
        skip = 1
        next
      }
      skip && /^(### |## |# )/ {
        skip = 0
        print ""
      }
      !skip { print }
    ' "$agents_path" > "$agents_path.tmp"
    mv "$agents_path.tmp" "$agents_path"
    echo -e "${GREEN}  ✓ Updated Auto-invoke section${NC}"
  else
    printf "\n%s\n" "$auto_invoke_section" >> "$agents_path"
    echo -e "${GREEN}  ✓ Added Auto-invoke section${NC}"
  fi

  rm -f "$section_file"
done

echo ""
echo -e "${GREEN}Done!${NC}"

echo ""
echo -e "${BLUE}Skills missing sync metadata:${NC}"
missing=0
for skill_file in "${SKILL_FILES_SORTED[@]}"; do
  [[ -f "$skill_file" ]] || continue
  skill_name="$(extract_field "$skill_file" "name")"
  scope_raw="$(extract_metadata "$skill_file" "scope")"
  auto_invoke_raw="$(extract_metadata "$skill_file" "auto_invoke")"
  if [[ -z "$scope_raw" || -z "$auto_invoke_raw" ]]; then
    echo -e "  ${YELLOW}$skill_name${NC} - missing: ${scope_raw:+}${scope_raw:-scope} ${auto_invoke_raw:+}${auto_invoke_raw:-auto_invoke}"
    missing=$((missing + 1))
  fi
done

if [[ $missing -eq 0 ]]; then
  echo -e "  ${GREEN}All skills have sync metadata${NC}"
fi
