import { useMemo } from "react";
import * as Diff from "diff";

interface SuggestionDiffProps {
    original: string;
    suggested: string;
    onAccept: () => void;
    onReject: () => void;
    position: { top: number; left: number };
    isStreaming?: boolean;
}

export default function SuggestionDiff({ original, suggested, onAccept, onReject, position, isStreaming = false }: SuggestionDiffProps) {
    const diff = useMemo(() => {
        if (!suggested) return [];
        return Diff.diffWords(original, suggested);
    }, [original, suggested]);

    return (
        <div
            style={{
                position: "absolute",
                top: position.top,
                left: position.left,
                zIndex: 1000,
                maxWidth: "500px"
            }}
            className='bg-white border border-gray-300 rounded-lg shadow-lg p-4'
        >
            <div className='text-xs font-semibold text-gray-600 mb-2'>{isStreaming ? "Generating suggestion..." : "Suggested changes"}</div>

            <div className='bg-gray-50 p-3 rounded mb-3 max-h-[200px] overflow-auto text-sm leading-relaxed'>
                {diff.map((part, index) => {
                    if (part.added) {
                        return (
                            <span key={index} className='bg-green-200 text-green-900'>
                                {part.value}
                            </span>
                        );
                    }
                    if (part.removed) {
                        return (
                            <span key={index} className='bg-red-200 text-red-900 line-through'>
                                {part.value}
                            </span>
                        );
                    }
                    return <span key={index}>{part.value}</span>;
                })}
            </div>

            <div className='flex gap-2 justify-end'>
                <button
                    onClick={onReject}
                    disabled={isStreaming}
                    className='px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50'
                >
                    Reject
                </button>
                <button
                    onClick={onAccept}
                    disabled={isStreaming}
                    className='px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50'
                >
                    Accept
                </button>
            </div>
        </div>
    );
}
