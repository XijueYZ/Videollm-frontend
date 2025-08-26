import { createContext, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";

export enum SidebarKey {
    Stream = 'stream',
    Chat = 'chat'
}

export enum VideoStreamType {
    Camera = 'camera',
    Screen = 'screen'
}

export const ChatContext = createContext<{
    socketRef: RefObject<Socket | null>;
    isConnected: boolean;
    messages: Message[];
    addMessage: (message: Partial<Message>) => void;
    loading: boolean;
    sendMessage: (content: string, files: File[]) => void;
    isVideoStreaming: boolean;
    setIsVideoStreaming: Dispatch<SetStateAction<boolean>>;
    videoStreamType: string | null;
    setVideoStreamType: Dispatch<SetStateAction<string | null>>;
}>({
    socketRef: { current: null },
    isConnected: false,
    messages: [],
    addMessage: () => { },
    loading: false,
    sendMessage: () => { },
    isVideoStreaming: false,
    setIsVideoStreaming: () => { },
    videoStreamType: null,
    setVideoStreamType: () => { },
});