import { useState, useCallback } from "react";

export interface SuggestionRange {
    index: number;
    length: number;
}

export interface Suggestion {
    id: string;
    range: SuggestionRange;
    original: string;
    suggested: string;
    status: "pending" | "streaming" | "completed";
    prompt?: string;
}

export function useSuggestions() {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

    const checkOverlap = useCallback((range1: SuggestionRange, range2: SuggestionRange): boolean => {
        return !(range1.index + range1.length <= range2.index || range2.index + range2.length <= range1.index);
    }, []);

    const hasOverlap = useCallback(
        (range: SuggestionRange): boolean => {
            return suggestions.some((s) => checkOverlap(s.range, range));
        },
        [suggestions, checkOverlap]
    );

    const addSuggestion = useCallback(
        (suggestion: Suggestion): boolean => {
            if (hasOverlap(suggestion.range)) {
                return false;
            }
            setSuggestions((prev) => [...prev, suggestion]);
            return true;
        },
        [hasOverlap]
    );

    const updateSuggestion = useCallback((id: string, updates: Partial<Suggestion>) => {
        setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    }, []);

    const removeSuggestion = useCallback((id: string) => {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
    }, []);

    const getSuggestionById = useCallback(
        (id: string): Suggestion | undefined => {
            return suggestions.find((s) => s.id === id);
        },
        [suggestions]
    );

    return {
        suggestions,
        addSuggestion,
        updateSuggestion,
        removeSuggestion,
        getSuggestionById,
        hasOverlap
    };
}
