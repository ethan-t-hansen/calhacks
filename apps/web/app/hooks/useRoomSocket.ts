import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface UseRoomSocketProps {
  documentId: string;
  userId: string;
  autoConnect?: boolean;
}

interface SocketMessage {
  type: string;
  data?: any;
  message?: string;
  timestamp: string;
}

export function useRoomSocket({
  documentId,
  userId,
  autoConnect = false,
}: UseRoomSocketProps): {
  socketConnected: boolean;
  socketMessages: SocketMessage[];
  connectSocket: () => void;
  disconnectSocket: () => void;
  sendChatMessage: (payload: {
    doc_id: string;
    user_id: string;
    request_completion: boolean;
    message: string;
    position?: { range: { head: number; anchor: number } };
  }) => void;
  sendAwareness: (data: any) => void;
  sendYjsUpdate: (update: Uint8Array) => void;
  leaveRoom: () => void;
  socket: Socket | null;
} {
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketMessages, setSocketMessages] = useState<SocketMessage[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const sendChatMessage = (payload: {
    doc_id: string;
    user_id: string;
    request_completion: boolean;
    message: string;
    position?: { range: { head: number; anchor: number } };
  }) => {
    if (!socketRef.current?.connected) {
      console.error("Socket not connected — cannot send chat payload");
      return;
    }
    socketRef.current.emit("chat", payload);
  };

  const sendAwareness = (data: any) => {
    socketRef.current?.emit("awareness", data);
  };

  const sendYjsUpdate = (update: Uint8Array) => {
    socketRef.current?.emit("update", {
      documentId,
      userId,
      update,
    });
  };

  const leaveRoom = () => {
    socketRef.current?.emit("leave", {
      doc_id: documentId,
      user_id: userId,
    });
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const connectSocket = () => {
    if (!userId) {
      console.error("Missing userId");
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      setSocketMessages((prev) => [
        ...prev,
        {
          type: "connection",
          message: "Connected to Socket.IO",
          timestamp: new Date().toISOString(),
        },
      ]);

      socket.emit("join", {
        doc_id: documentId,
        user_id: userId,
      });
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setSocketMessages((prev) => [
        ...prev,
        {
          type: "connection",
          message: "Disconnected from Socket.IO",
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    socket.on("user_join", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "user_join", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("user_left", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "user_left", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("aware", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "aware", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("yjs", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "yjs", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("chat", (data: any) => {
      const { doc_id, user_id, message, position } = data;
      const newMessage: SocketMessage = {
        type: "chat",
        data: {
          role: user_id === "ai" ? "ai" : "user",
          content: message,
          username: user_id,
          position,
        },
        message,
        timestamp: new Date().toISOString(),
      };
      setSocketMessages((prev) => [...prev, newMessage]);
    });

    socket.on("chunk", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "chunk", data, timestamp: new Date().toISOString() },
      ]);
    });
  };

  useEffect(() => {
    if (autoConnect && userId && documentId) {
      console.log("Auto-connecting socket with userId:", userId);
      connectSocket();
    }

    return () => {
      if (socketRef.current) {
        leaveRoom();
        disconnectSocket();
      }
    };
  }, [autoConnect, documentId, userId]);

  return {
    socketConnected,
    socketMessages,
    connectSocket,
    disconnectSocket,
    sendChatMessage,
    sendAwareness,
    sendYjsUpdate,
    leaveRoom,
    socket: socketRef.current,
  };
}