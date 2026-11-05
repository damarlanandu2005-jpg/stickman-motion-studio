#!/usr/bin/env bash
# usage: stills.sh <project> <frames comma separated> <out dir>
cd "$1" && rm -rf "$3" && mkdir -p "$3" && node render.mjs "$3" "$2" 2>&1 | tail -5 && python3 sheet.py "$3" "$3/../sheet_$(basename $3).jpg" 2>&1 | tail -2
