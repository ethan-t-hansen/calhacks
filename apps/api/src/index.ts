import Fastify from "fastify";
import OpenAI from "openai";
import fastifyCors from "@fastify/cors";

const app = Fastify({ logger: true });

const client = new OpenAI({
  baseURL: "https://janitorai.com/hackathon",
  apiKey: "calhacks2047",
});

app.register(fastifyCors, { origin: "http://localhost:3000" });

app.get("/", async () => ({ hello: "world" }));

app.get("/health", async () => ({ status: "ok" }));

app.post("/chat", async (request, reply) => {
  const { messages } = request.body as { messages: any[] };

  reply.hijack();

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "http://localhost:3000",
  });

  try {
    const stream = await client.chat.completions.create({
      model: "x2",
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        reply.raw.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    reply.raw.write("data: [DONE]\n\n");
  } catch (error: any) {
    reply.raw.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    reply.raw.end();
  }
});

app.listen({ port: 3001, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server running at ${address}`);
});
