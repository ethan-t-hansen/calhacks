"use client";
import { useEffect, useRef, useState } from "react";
import type Quill from "quill";
import type { QuillBinding } from "y-quill";
import * as Y from "yjs";
import "quill/dist/quill.snow.css";
import { Socket } from "socket.io-client";
import { Awareness } from "y-protocols/awareness.js";

interface CollaborativeEditorProps {
  documentId: string;
  userId: string;
  userName: string;
  userColor: string;
  socket: Socket | null;
  socketConnected: boolean;
}

export default function CollaborativeEditor({
  documentId,
  userId,
  socket,
  socketConnected,
}: CollaborativeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const bindingRef = useRef<QuillBinding | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
      const ytext = ydoc.getText("quill");

      const quill = new QuillConstructor(editorRef.current!, {
        theme: "snow",
        placeholder: "Start collaborating...",
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link", "blockquote", "code-block"],
            ["clean"],
          ],
          history: {
            userOnly: true,
          },
        },
      });
      quillRef.current = quill;

      const awareness = new Awareness(ydoc);
      awareness.setLocalStateField("user", {
        id: userId,
      });

      const binding = new QuillBindingConstructor(ytext, quill, awareness);
      bindingRef.current = binding;

      const updateHandler = (update: Uint8Array, origin: any) => {
        if (origin !== socket && socket?.connected) {
          socket.emit("yjs-update", {
            documentId,
            userId,
            update: Array.from(update),
          });
        }
      };

      ydoc.on("update", updateHandler);

      const yjsUpdateListener = (data: { update: number[]; userId: string }) => {
        if (data.userId !== userId) {
          const update = new Uint8Array(data.update);
          Y.applyUpdate(ydoc, update, socket);
        }
      };

      socket.on("yjs-update", yjsUpdateListener);

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

      setIsConnected(socketConnected);
      setIsLoading(false);
    };

    initEditor();

    return () => {
      if (ydocRef.current && bindingRef.current && quillRef.current) {
        const ydoc = ydocRef.current;
        socket.off("yjs-update");
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

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          fontSize: "12px",
          padding: "8px 0",
          opacity: 0.6,
          display: "flex",
          alignItems: "center",
          gap: "8px",
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
          lineHeight: "1.8",
        }}
      />
    </div>
  );
}