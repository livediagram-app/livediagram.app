#!/usr/bin/env bash
# Run a command against the CUDA build of TensorFlow. libtensorflow 2.9 (what
# tfjs-node-gpu 4.22 ships) needs the CUDA 11 and cuDNN 8 runtime libraries;
# point STICKY_MODEL_CUDA_LIBS at a folder holding them (the NVIDIA
# redistributable archives, unpacked). Memory growth stays on so the GPU is
# shared politely with whatever else is running on it.
set -euo pipefail
export LD_LIBRARY_PATH="${STICKY_MODEL_CUDA_LIBS:-/tmp/livediagram-sticky-model/cuda11/lib}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export STICKY_MODEL_GPU=1
export TF_FORCE_GPU_ALLOW_GROWTH=true
export TF_CPP_MIN_LOG_LEVEL="${TF_CPP_MIN_LOG_LEVEL:-2}"
exec "$@"
