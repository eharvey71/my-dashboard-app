// Vector-index operations, executed server-side.
//
// This module previously held a live Pinecone key and imported an OpenAI key
// via aiService.js, both of which shipped in the browser bundle. It is now a
// thin wrapper over Cloud Functions callables; no credentials reach the client
// and the caller's uid is derived server-side from the auth context.
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseApp";

const indexContentFn = httpsCallable(functions, "indexContent");
const updateVectorFn = httpsCallable(functions, "updateVector");
const deleteVectorFn = httpsCallable(functions, "deleteVector");

export const indexContent = async (
  projectId,
  content,
  type,
  id,
  additionalContext = "",
  source = "native"
) => {
  await indexContentFn({ projectId, content, type, id, additionalContext, source });
};

export const updateVector = async (projectId, id, content, type) => {
  await updateVectorFn({ projectId, id, content, type });
};

export const deleteVector = async (projectId, id, type) => {
  await deleteVectorFn({ projectId, id, type });
};
