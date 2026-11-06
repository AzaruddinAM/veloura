#!/usr/bin/env bash
# Compares the build of the live version (<old>) with the new build (<new>) and
# writes an lftp script that uploads only files that are new or different and
# deletes only files the new version no longer has. Unchanged files are not touched.
#
# Usage: deploy/plan.sh <old dir> <new dir> <remote dir> <lftp script out> <summary out>
set -euo pipefail

old=$1 new=$2 remote=$3 script=$4 summary=$5
: > "$script"
up=0 del=0
declare -A made=()

files() { (cd "$1" && find . -type f | sed 's#^\./##' | LC_ALL=C sort); }

# New or changed files.
while IFS= read -r f; do
  if [ ! -f "$old/$f" ] || ! cmp -s "$old/$f" "$new/$f"; then
    dir=$(dirname "$f")
    if [ "$dir" != "." ] && [ -z "${made[$dir]:-}" ]; then
      echo "mkdir -p -f \"$remote$dir\"" >> "$script"
      made[$dir]=1
    fi
    echo "put \"$new/$f\" -o \"$remote$f\"" >> "$script"
    echo "- upload \`$remote$f\`" >> "$summary"
    up=$((up + 1))
  fi
done < <(files "$new")

# Files the new version no longer has.
while IFS= read -r f; do
  if [ ! -f "$new/$f" ]; then
    echo "rm -f \"$remote$f\"" >> "$script"
    echo "- delete \`$remote$f\`" >> "$summary"
    del=$((del + 1))
  fi
done < <(files "$old")

echo "$remote: $up to upload, $del to delete"
