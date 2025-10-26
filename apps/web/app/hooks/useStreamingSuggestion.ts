import { useState, useCallback } from "react";

interface StreamingSuggestionParams {
    doc_id: string;
    user_id: string;
    prompt: string;
    context: string;
    range?: { index: number; length: number };
}

export function useStreamingSuggestion() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSuggestion = useCallback(
        async (params: StreamingSuggestionParams, onChunk: (chunk: string) => void, onComplete: (fullText: string) => void) => {
            setIsStreaming(true);
            setError(null);

            try {
                const response = await fetch("http://localhost:3001/completions/suggest", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(params)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error("No reader available");
                }

                let fullSuggestion = "";
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    fullSuggestion += chunk;
                    onChunk(chunk);
                }

                onComplete(fullSuggestion);
                setIsStreaming(false);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Unknown error";
                setError(errorMessage);
                setIsStreaming(false);
                throw err;
            }
        },
        []
    );

    return {
        fetchSuggestion,
        isStreaming,
        error
    };
}
