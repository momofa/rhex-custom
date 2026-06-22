#!/bin/sh
set -eu

node scripts/apply-next-asset-prefix.mjs

exec "$@"
