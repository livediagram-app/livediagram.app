#!/usr/bin/env bash
# Install TensorFlow's native Node bindings for training and scoring, OUTSIDE
# the workspace: they download libtensorflow (hundreds of MB, CPU and GPU
# builds) in an install script, which no `pnpm install` of the monorepo should
# pay for. `scripts/model/tf.ts` loads them from here.
#
#   scripts/install-tfjs-node.sh [--gpu]
set -euo pipefail
DIR="${STICKY_MODEL_TF_DIR:-${STICKY_MODEL_DIR:-/tmp/livediagram-sticky-model}/tfjs}"
PACKAGES=("@tensorflow/tfjs-node@4.22.0")
if [[ "${1:-}" == "--gpu" ]]; then PACKAGES+=("@tensorflow/tfjs-node-gpu@4.22.0"); fi
mkdir -p "$DIR"
[[ -f "$DIR/package.json" ]] || echo '{ "private": true }' > "$DIR/package.json"
npm install --prefix "$DIR" --no-audit --no-fund "${PACKAGES[@]}"
echo "tfjs-node installed in $DIR"
