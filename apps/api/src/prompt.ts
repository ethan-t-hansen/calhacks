import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const client = new OpenAI({
    baseURL: "https://janitorai.com/hackathon",
    apiKey: "calhacks2047"
});

export async function createCompletion(messages: ChatCompletionMessageParam[]) {
    try {
        const stream = await client.chat.completions.create({
            model: "x2",
            messages,
            stream: true
        });

        let fullResponse = "";

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                fullResponse += content;
                console.log("Streaming chunk:", content);
            }
        }

        console.log("Full formatted response:", fullResponse);
        return {
            message: fullResponse,
            formatted: true
        };
    } catch (error) {
        console.error("Error generating chat completion:", error);
        throw error;
    }
}
