import { getStore } from "@netlify/blobs";

const STORE_NAME = "testflow-data";

function getTestFlowStore() {
  return getStore(STORE_NAME);
}

export async function readBlobJSON(key, fallback = null) {
  const store = getTestFlowStore();

  const data = await store.get(key, {
    type: "json",
    consistency: "strong",
  });

  return data === null ? fallback : data;
}

export async function writeBlobJSON(key, value) {
  const store = getTestFlowStore();
  await store.setJSON(key, value);
}

export async function deleteBlob(key) {
  const store = getTestFlowStore();
  await store.delete(key);
}
