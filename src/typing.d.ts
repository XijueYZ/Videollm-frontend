type SideBarItem = {
    label: string,
    key: string,
    icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>,
    conversations?: Conversation[],
    onLoadConversation?: (conversationId: string) => void,
    onDeleteConversation?: (conversationId: string) => void,
    onClearConversation?: () => void,
    currentConversationId?: string
}
type Conversation = {
    id: string
    title: string
    createdAt: string
}

type Message = {
    content?: string;
    files?: File[];
    history_files?: {
        images?: Array<{
            path: string;
            name: string;
            url?: string;
        }>;
        videos?: Array<{
            path: string;
            name: string;
            url?: string;
        }>;
    };
    isUser?: boolean;
    isError?: boolean;
    timestamp?: number;
    id: string;
    end?: boolean;
    loading?: boolean;
    historySeperator?: boolean; // 历史消息分割线
}

type VideoDataType = {
    name: string;
    type: string;
    size: number;
    path: string;
    file: File;
}