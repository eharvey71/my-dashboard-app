#!/usr/bin/env bash
# Firestore vector indexes cannot be declared in firebase.json or
# firestore.indexes.json - they are created through gcloud. Run this once per
# environment before deploying, or querySimilarContent returns nothing for the
# collections that are missing an index.
#
# Each index must match the query exactly: the same equality filters, in order,
# followed by the vector field.
set -euo pipefail

PROJECT="${1:-mydashboard-ff9ae}"
DIMENSION=1536   # text-embedding-ada-002

for COLLECTION in notes tasks documents; do
  echo "Creating vector index for ${COLLECTION}..."
  gcloud firestore indexes composite create \
    --project="${PROJECT}" \
    --collection-group="${COLLECTION}" \
    --query-scope=COLLECTION \
    --field-config=field-path=userId,order=ASCENDING \
    --field-config=field-path=projectId,order=ASCENDING \
    --field-config="field-path=embedding,vector-config={\"dimension\":\"${DIMENSION}\",\"flat\":\"{}\"}"
done

# Bookmark chunks are queried with a collection-group query, so this index uses
# COLLECTION_GROUP scope rather than COLLECTION.
echo "Creating vector index for bookmark chunks..."
gcloud firestore indexes composite create \
  --project="${PROJECT}" \
  --collection-group=chunks \
  --query-scope=COLLECTION_GROUP \
  --field-config=field-path=userId,order=ASCENDING \
  --field-config=field-path=projectId,order=ASCENDING \
  --field-config="field-path=embedding,vector-config={\"dimension\":\"${DIMENSION}\",\"flat\":\"{}\"}"

echo
echo "Index builds are asynchronous. Check status with:"
echo "  gcloud firestore indexes composite list --project=${PROJECT}"
