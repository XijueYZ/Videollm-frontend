import { createContext, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";

export enum SidebarKey {
    Stream = 'stream',
    Chat = 'chat'
}

export const ChatContext = createContext<{
    socketRef: RefObject<Socket | null>;
    isConnected: boolean;
    messages: Message[];
    setMessages: Dispatch<SetStateAction<Message[]>>;
    loading: boolean;
}>({
    socketRef: { current: null },
    isConnected: false,
    messages: [],
    setMessages: () => { },
    loading: false,
});