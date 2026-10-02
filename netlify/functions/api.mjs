process.env.NETLIFY = "true";

const { app, startServer } = await import("../../backend/server.js");
const serverless = (await import("serverless-http")).default;

await startServer(false);

export const handler = serverless(app);