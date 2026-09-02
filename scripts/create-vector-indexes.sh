#!/usr/bin/env bash
# Firestore vector indexes cannot be declared in firebase.json or
# firestore.indexes.json - they are created through gcloud. Run this once per
# environment before deploying, or querySimilarContent returns nothing for the
# collections that are missing an index.
#
# Each index must match the query exactly: the same equality filters, in order,
# followed by the vector field. Re-running is safe - indexes that already exist
# are reported and skipped.
set -uo pipefail

PROJECT="${1:-mydashboard-ff9ae}"
DIMENSION=1536   # text-embedding-ada-002
FAILED=0

create_index() {
  local collection="$1"
  local scope="$2"

  echo "Creating vector index for ${collection} (${scope})..."

  local output
  # --async returns as soon as the build is queued. Without it gcloud blocks
  # until the index finishes building, which can take many minutes per index.
  output=$(gcloud firestore indexes composite create \
    --async \
    --project="${PROJECT}" \
    --collection-group="${collection}" \
    --query-scope="${scope}" \
    --field-config=field-path=userId,order=ASCENDING \
    --field-config=field-path=projectId,order=ASCENDING \
    --field-config="field-path=embedding,vector-config={\"dimension\":\"${DIMENSION}\",\"flat\":\"{}\"}" \
    2>&1)
  local status=$?

  if [ $status -eq 0 ]; then
    echo "  build queued."
  elif grep -q "ALREADY_EXISTS" <<<"${output}"; then
    echo "  already exists, skipping."
  else
    echo "  FAILED:"
    echo "${output}" | sed 's/^/    /'
    FAILED=1
  fi
}

for COLLECTION in notes tasks documents; do
  create_index "${COLLECTION}" COLLECTION
done

# Bookmark chunks are queried with a collection-group query, so this index uses
# COLLECTION_GROUP scope rather than COLLECTION.
create_index chunks COLLECTION_GROUP

echo
if [ $FAILED -ne 0 ]; then
  echo "One or more indexes failed - see above."
else
  echo "All index builds queued or already present."
fi

echo "Index builds are asynchronous. Check status with:"
echo "  gcloud firestore indexes composite list --project=${PROJECT}"

exit $FAILED
