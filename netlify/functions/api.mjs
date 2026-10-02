process.env.NETLIFY = "true";

import { app, startServer } from "../../backend/server.js";
import serverless from "serverless-http";

let initialized = false;
let initializationPromise;

async function initialize() {
  if (!initialized) {
    if (!initializationPromise) {
      initializationPromise = startServer(false).then(() => {
        initialized = true;
      });
    }
    await initializationPromise;
  }
}

export const handler = async (event, context) => {
  await initialize();
  return serverless(app)(event, context);
};