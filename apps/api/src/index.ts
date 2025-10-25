// apps/api/src/index.ts
import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

app.listen({ port: 3001 }, (err) => {
  if (err) throw err;
  console.log("API ready at http://localhost:3001");
});