import { Home, MessageCircle } from "lucide-react";
import { createContext, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";

export enum SidebarKey {
    Stream = 'stream',
    Chat = 'chat'
}

export enum VideoStreamType {
    Camera = 'camera',
    Screen = 'screen',
    File = 'file'
}

export const defaultItems: SideBarItem[] = [
    {
        label: 'Chat',
        key: SidebarKey.Chat,
        icon: Home
    },
    {
        label: 'Stream',
        key: SidebarKey.Stream,
        icon: MessageCircle
    }
]

export const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const ChatContext = createContext<{
    socketRef: RefObject<Socket | null>;
    isConnected: boolean;
    messages: Message[];
    addMessage: (message: Partial<Message>) => void;
    sendMessage: (content: string, files: (File | VideoDataType)[], type: SidebarKey, otherParams: Record<string, any> | undefined) => void;
    isVideoStreaming: boolean;
    setIsVideoStreaming: Dispatch<SetStateAction<boolean>>;
    videoStreamType: string | null;
    setVideoStreamType: Dispatch<SetStateAction<string | null>>;
}>({
    socketRef: { current: null },
    isConnected: false,
    messages: [],
    addMessage: () => { },
    sendMessage: () => { },
    isVideoStreaming: false,
    setIsVideoStreaming: () => { },
    videoStreamType: null,
    setVideoStreamType: () => { },
});

export const qualityConfig = {
    '480p': { width: 854, height: 480 },
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
}