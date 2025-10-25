// apps/api/src/index.ts
import Fastify from "fastify";
import { createCompletion } from "./prompt";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

app.post("/chat", async (request, reply) => {
  // const { messages } = request.body as { messages: ChatCompletionMessageParam[] };

  try {
    const response = await createCompletion([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello!" },
    ]);
    return { message: response };
  } catch (error) {
    reply.status(500).send({ error: "Failed to get completion" });
  }
});

app.listen({ port: 3001 }, (err) => {
  if (err) throw err;
  console.log("API ready at http://localhost:3001");
});
