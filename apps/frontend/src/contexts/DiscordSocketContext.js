"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const socketIo = io(process.env.NEXT_PUBLIC_BACKEND_URL, {
      transports: ["websocket"],
    });

    setSocket(socketIo);

    return () => {
      socketIo.disconnect();
    };
  }, []);

  const joinChannel = (channelId) => {
    if (socket) {
      socket.emit("join-channel", channelId);
    }
  };

  const leaveChannel = (channelId) => {
    if (socket) {
      socket.emit("leave-channel", channelId);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, joinChannel, leaveChannel }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
