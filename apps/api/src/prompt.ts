import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const client = new OpenAI({
  baseURL: "https://janitorai.com/hackathon",
  apiKey: "calhacks2047",
});

export async function createCompletion(messages: ChatCompletionMessageParam[]) {
  try {
    const completion = await client.chat.completions.create({
      model: "x2",
      messages
    });

    return completion;
  } catch (error) {
    console.error("Error generating chat completion:", error);
    throw error;
  }
}