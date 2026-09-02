#!/usr/bin/env bash
# Build and deploy Cognify.
#
#   ./deploy.sh              build + deploy hosting (the usual)
#   ./deploy.sh functions    deploy Cloud Functions only
#   ./deploy.sh all          both
#
# Firestore rules are deliberately not here - deploy those deliberately with
# `firebase deploy --only firestore:rules` after testing in the console's Rules
# Playground, since bad rules can lock you out of your own data.
set -euo pipefail

TARGET="${1:-hosting}"

build_and_check() {
  npm run build

  # The OpenAI, Google OAuth, Pinecone and LinkPreview keys were once hardcoded
  # in the frontend. Fail loudly if any of them ever comes back.
  for key in "sk-proj-" "GOCSPX-" "5f9fc0b2-87f2" "aedc1f8b83d6"; do
    if grep -rqF "$key" dist/; then
      echo "ERROR: found '$key' in the built bundle. Not deploying." >&2
      exit 1
    fi
  done
}

case "$TARGET" in
  hosting)
    build_and_check
    firebase deploy --only hosting
    ;;
  functions)
    firebase deploy --only functions
    ;;
  all)
    build_and_check
    firebase deploy --only functions,hosting
    ;;
  *)
    echo "Usage: ./deploy.sh [hosting|functions|all]" >&2
    exit 1
    ;;
esac
