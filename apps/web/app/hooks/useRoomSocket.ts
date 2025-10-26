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
    autoConnect = false
  }: UseRoomSocketProps): {
    socketConnected: boolean;
    socketMessages: SocketMessage[];
    connectSocket: () => void;
    disconnectSocket: () => void;
    sendMessage: (message: any) => void;
    sendYjsUpdate: (update: Uint8Array) => void;
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

    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      setSocketMessages((prev) => [
        ...prev,
        { type: "connection", message: "Connected to Socket.IO", timestamp: new Date().toISOString() }
      ]);

      socket.emit("join-room", {
        documentId,
        userId,
        name: userName,
        color: userColor
      });
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setSocketMessages((prev) => [
        ...prev,
        { type: "connection", message: "Disconnected from Socket.IO", timestamp: new Date().toISOString() }
      ]);
    });

    socket.on("user-joined", (data: any) => {
      setSocketMessages((prev) => [...prev, { type: "user-joined", data, timestamp: new Date().toISOString() }]);
    });

    socket.on("user-left", (data: any) => {
      setSocketMessages((prev) => [...prev, { type: "user-left", data, timestamp: new Date().toISOString() }]);
    });

    socket.on("message", (data: any) => {
      setSocketMessages((prev) => [...prev, { type: "message", data, timestamp: new Date().toISOString() }]);
    });

    socket.on("ai-message", (data: any) => {
      setSocketMessages((prev) => [...prev, { type: "ai-message", data, timestamp: new Date().toISOString() }]);
    });

    socket.on("yjs-update", (data: any) => {
      setSocketMessages((prev) => [...prev, { type: "yjs-update", data, timestamp: new Date().toISOString() }]);
    });

    socket.on("suggestion-resolution", (data: any) => {
      setSocketMessages((prev) => [...prev, { type: "suggestion-resolution", data, timestamp: new Date().toISOString() }]);
    });

    socket.on("error", (error: any) => {
      setSocketMessages((prev) => [...prev, { type: "error", message: error.message, timestamp: new Date().toISOString() }]);
    });
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const sendMessage = (message: any) => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.error("Socket not connected");
      return;
    }
    socketRef.current.emit("message", message);
  };

  const sendYjsUpdate = (update: Uint8Array) => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.error("Socket not connected");
      return;
    }
    socketRef.current.emit("yjs-update", {
      documentId,
      userId,
      update
    });
  };

  useEffect(() => {
    if (autoConnect && userId && userName && userColor) {
      connectSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [autoConnect, documentId, userId, userName, userColor]);

  return {
    socketConnected,
    socketMessages,
    connectSocket,
    disconnectSocket,
    sendMessage,
    sendYjsUpdate,
    socket: socketRef.current
  };
}