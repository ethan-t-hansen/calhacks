import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

interface SuggestionToolbarProps {
    visible: boolean;
    position: { top: number; left: number };
    onRequestSuggestion: (prompt: string) => void;
    onClose?: () => void;
    disabled?: boolean;
}

export default function SuggestionToolbar({ visible, position, onRequestSuggestion, onClose, disabled = false }: SuggestionToolbarProps) {
    const [prompt, setPrompt] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (visible && inputRef.current) {
            inputRef.current.focus();
        }
    }, [visible]);

    const handleSubmit = () => {
        const finalPrompt = prompt.trim() || "improve this writing";
        onRequestSuggestion(finalPrompt);
        setPrompt("");
    };

    if (!visible) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                zIndex: 1000
            }}
            className='bg-white border border-gray-300 rounded-lg shadow-lg p-3 flex gap-2 items-center min-w-[300px]'
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            <Input
                ref={inputRef}
                type='text'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        handleSubmit();
                    }
                    if (e.key === "Escape") {
                        e.preventDefault();
                    }
                }}
                placeholder='improve this writing'
                disabled={disabled}
                className='flex-1 text-sm'
                onFocus={(e) => e.stopPropagation()}
            />
            <button
                onClick={handleSubmit}
                disabled={disabled}
                onMouseDown={(e) => {
                    e.preventDefault();
                }}
                className='px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
            >
                Suggest
            </button>
            {onClose && (
                <button
                    onClick={onClose}
                    onMouseDown={(e) => {
                        e.preventDefault();
                    }}
                    className='px-2 py-1 text-gray-500 text-sm hover:text-gray-700'
                    title='Close (Esc)'
                >
                    ✕
                </button>
            )}
        </div>
    );
}
