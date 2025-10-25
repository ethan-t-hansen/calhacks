import OpenAI from "openai";

export const client = new OpenAI({
  baseURL: "https://janitorai.com/hackathon",
  apiKey: "calhacks2047",
});

export async function createCompletion(messages: any) {
  try {
    const completion = await client.chat.completions.create({
      model: "x2",
      messages,
      stream: true
    });

    for await (const chunk of completion) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) process.stdout.write(delta);
    }

    return completion;
  } catch (error) {
    console.error("Error generating chat completion:", error);
    throw error;
  }
}