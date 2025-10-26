"use client";
import { useEffect, useRef, useState } from "react";
import type Quill from "quill";
import type { QuillBinding } from "y-quill";
import * as Y from "yjs";
import "quill/dist/quill.snow.css";
import { Socket } from "socket.io-client";
import { Awareness } from "y-protocols/awareness.js";
import SuggestionToolbar from "./SuggestionToolbar";
import SuggestionDiff from "./SuggestionDiff";
import { useSuggestions } from "../hooks/useSuggestions";
import { useStreamingSuggestion } from "../hooks/useStreamingSuggestion";

interface CollaborativeEditorProps {
    documentId: string;
    userId: string;
    socket: Socket | null;
    socketConnected: boolean;
}

export default function CollaborativeEditor({ documentId, userId, socket, socketConnected }: CollaborativeEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<Quill | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    const bindingRef = useRef<QuillBinding | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [showToolbar, setShowToolbar] = useState(false);
    const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
    const [selectionRange, setSelectionRange] = useState<{ index: number; length: number } | null>(null);
    const [selectedText, setSelectedText] = useState("");

    const [currentSuggestion, setCurrentSuggestion] = useState<{
        original: string;
        suggested: string;
        range: { index: number; length: number };
    } | null>(null);
    const [diffPosition, setDiffPosition] = useState({ top: 0, left: 0 });

    const { addSuggestion, updateSuggestion, removeSuggestion } = useSuggestions();
    const { fetchSuggestion, isStreaming } = useStreamingSuggestion();

    useEffect(() => {
        if (!editorRef.current || !documentId || !socket) return;

        let QuillConstructor: typeof Quill;
        let QuillBindingConstructor: typeof QuillBinding;

        const initEditor = async () => {
            const QuillModule = await import("quill");
            const { QuillBinding: QuillBindingModule } = await import("y-quill");

            QuillConstructor = QuillModule.default;
            QuillBindingConstructor = QuillBindingModule;

            const ydoc = new Y.Doc();
            ydocRef.current = ydoc;
            const ytext = ydoc.getText("content");

            const quill = new QuillConstructor(editorRef.current!, {
                theme: "snow",
                placeholder: "Start collaborating...",
                modules: {
                    toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ["bold", "italic", "underline", "strike"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        ["link", "blockquote", "code-block"],
                        ["clean"]
                    ],
                    history: {
                        userOnly: true
                    }
                }
            });
            quillRef.current = quill;

            const awareness = new Awareness(ydoc);
            awareness.setLocalStateField("user", {
                id: userId
            });

            const binding = new QuillBindingConstructor(ytext, quill, awareness);
            bindingRef.current = binding;

            const updateHandler = (update: Uint8Array, origin: any) => {
                if (origin !== socket && socket?.connected) {
                    socket.emit("update", {
                        doc_id: documentId,
                        update: Array.from(update)
                    });
                }
            };

            ydoc.on("update", updateHandler);

            const yjsUpdateListener = (data: { update: number[] }) => {
                const update = new Uint8Array(data.update);
                Y.applyUpdate(ydoc, update, socket);
            };

            socket.on("yjs", yjsUpdateListener);

            const yjsSyncResponseListener = (data: { documentId: string; update: number[] }) => {
                if (data.update && data.update.length > 0) {
                    const update = new Uint8Array(data.update);
                    Y.applyUpdate(ydoc, update, socket);
                }
            };

            socket.on("yjs-sync-response", yjsSyncResponseListener);

            const stateVector = Y.encodeStateVector(ydoc);
            socket.emit("yjs-sync-request", {
                documentId,
                userId,
                stateVector: Array.from(stateVector)
            });

            quill.on("selection-change", (range) => {
                if (range && range.length > 0) {
                    const text = quill.getText(range.index, range.length);
                    setSelectedText(text);
                    setSelectionRange({ index: range.index, length: range.length });

                    const bounds = quill.getBounds(range.index, range.length);
                    const editorRect = editorRef.current?.getBoundingClientRect();
                    if (editorRect && bounds) {
                        setToolbarPosition({
                            top: editorRect.top + bounds.bottom + window.scrollY + 5,
                            left: editorRect.left + bounds.left + window.scrollX
                        });
                    }
                    setShowToolbar(true);
                } else {
                    setShowToolbar(false);
                    setSelectionRange(null);
                    setSelectedText("");
                }
            });

            setIsConnected(socketConnected);
            setIsLoading(false);
        };

        initEditor();

        return () => {
            if (ydocRef.current && bindingRef.current && quillRef.current) {
                const ydoc = ydocRef.current;
                socket.off("yjs");
                socket.off("yjs-sync-response");
                bindingRef.current.destroy();
                ydoc.destroy();
                quillRef.current.disable();
            }
        };
    }, [documentId, userId, socket]);

    useEffect(() => {
        setIsConnected(socketConnected);
    }, [socketConnected]);

    const handleRequestSuggestion = async (prompt: string) => {
        if (!selectionRange || !quillRef.current) return;

        setShowToolbar(false);

        const range = selectionRange;
        const original = selectedText;

        setCurrentSuggestion({
            original,
            suggested: "",
            range
        });

        setDiffPosition(toolbarPosition);

        try {
            let streamedText = "";

            await fetchSuggestion(
                {
                    doc_id: documentId,
                    user_id: userId,
                    prompt,
                    context: original,
                    range
                },
                (chunk) => {
                    streamedText += chunk;
                    setCurrentSuggestion((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  suggested: streamedText
                              }
                            : null
                    );
                },
                (fullText) => {
                    setCurrentSuggestion((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  suggested: fullText
                              }
                            : null
                    );
                }
            );
        } catch (error) {
            console.error("Error fetching suggestion:", error);
            setCurrentSuggestion(null);
        }
    };

    const handleAcceptSuggestion = () => {
        if (!currentSuggestion || !quillRef.current) return;

        const quill = quillRef.current;
        const { range, suggested } = currentSuggestion;

        quill.deleteText(range.index, range.length);
        quill.insertText(range.index, suggested);

        setCurrentSuggestion(null);
        setSelectionRange(null);
        setSelectedText("");
    };

    const handleRejectSuggestion = () => {
        setCurrentSuggestion(null);
    };

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div
                style={{
                    fontSize: "12px",
                    padding: "8px 0",
                    opacity: 0.6,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                }}
            >
                <span>{isConnected ? "🟢" : "🔴"}</span>
                <span>{isConnected ? "Synced" : isLoading ? "Loading..." : "Connecting..."}</span>
            </div>
            <div
                ref={editorRef}
                style={{
                    flex: 1,
                    background: "var(--background)",
                    fontSize: "14px",
                    lineHeight: "1.8"
                }}
            />
            <SuggestionToolbar
                visible={showToolbar && !currentSuggestion}
                position={toolbarPosition}
                onRequestSuggestion={handleRequestSuggestion}
                disabled={isStreaming}
            />
            {currentSuggestion && (
                <SuggestionDiff
                    original={currentSuggestion.original}
                    suggested={currentSuggestion.suggested}
                    onAccept={handleAcceptSuggestion}
                    onReject={handleRejectSuggestion}
                    position={diffPosition}
                    isStreaming={isStreaming}
                />
            )}
        </div>
    );
}
