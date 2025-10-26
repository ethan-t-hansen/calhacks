import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface UseRoomSocketProps {
  documentId: string;
  userId: string;
  userName: string;
  userColor: string;
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
  userName,
  userColor,
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

  const connectSocket = () => {
    if (!userId || !userName || !userColor) {
      console.error("Missing required user information");
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    // Match backend socket root
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

    // Match controller roots
    socket.on("user-joined", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "user-joined", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("user-left", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "user-left", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("awareness", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "awareness", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("update", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "update", data, timestamp: new Date().toISOString() },
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
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Matches the controller "chat" route
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

  // Matches controller "awareness" handler
  const sendAwareness = (data: any) => {
    socketRef.current?.emit("awareness", data);
  };

  // Matches controller "update" handler
  const sendYjsUpdate = (update: Uint8Array) => {
    socketRef.current?.emit("update", {
      documentId,
      userId,
      update,
    });
  };

  // Matches controller "leave" handler
  const leaveRoom = () => {
    socketRef.current?.emit("leave", {
      documentId,
      userId,
    });
  };

  useEffect(() => {
    if (autoConnect && userId && documentId) {
      connectSocket();
    }

    return () => {
      leaveRoom();
      disconnectSocket();
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