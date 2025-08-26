import { useEffect, useRef, useState } from "react"
import { ChatContext, SidebarKey } from "./utils"
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import Chat from "./pages/Chat"
import Stream from "./pages/Stream"
import { SidebarTrigger } from "./components/ui/sidebar"
import { Badge } from "./components/ui/badge"
import { Wifi, WifiOff } from "lucide-react"
import { Separator } from "./components/ui/separator"

type Props = {
    type: SidebarKey
}

const socketUrl = 'ws://localhost:5000';

const ChatView: React.FC<Props> = ({ type }) => {
    const [isConnected, setIsConnected] = useState(false)
    const [modelId, setModelId] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false);
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
    const [isVideoStreaming, setIsVideoStreaming] = useState(false);
    const [videoStreamType, setVideoStreamType] = useState<string | null>(null);

    const messagesRef = useRef(messages)
    const modelIdRef = useRef(modelId)
    const socketRef = useRef<Socket | null>(null)

    // 更新 ref 值
    useEffect(() => {
        messagesRef.current = messages
    }, [messages])

    useEffect(() => {
        modelIdRef.current = modelId
    }, [modelId])

    // 切换页面时，清空消息
    useEffect(() => {
        setMessages([])
        setCurrentConversation(null)
        setIsVideoStreaming(false)
        setVideoStreamType(null)
    }, [type])


    useEffect(() => {
        initSocket();
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect()
            }
        }
    }, [])

    // 开启新对话
    const createNewConversation = () => {
        const id = uuidv4()
        setCurrentConversation({
            id: id,
            title: 'AI对话',
            createdAt: new Date().toISOString(),
        })
        setMessages([])
        return id;
    }

    // 消息管理
    const addMessage = (message: Partial<Message>) => {
        const newMessage = {
            id: uuidv4(),
            content: message.content,
            isUser: message.isUser,
            timestamp: Date.now(),
            isError: message.isError || false,
        } as Message

        setMessages(prev => [...prev, newMessage])
    }

    const initSocket = () => {
        if (socketRef.current) {
            socketRef.current.disconnect()
        }
        socketRef.current = io(socketUrl, {
            transports: ['websocket', 'polling'], // 添加备选传输方式
            timeout: 10000,
            forceNew: true,
            autoConnect: true,
        })

        // 连接成功
        socketRef.current.on('connect', () => {
            console.log('WebSocket 连接成功')
            setIsConnected(true)
        })

        // 连接确认，获取分配的模型ID
        // 在 initSocket() 方法中的 'connected' 事件处理器里修改：
        socketRef.current.on('connected', (data) => {
            console.log('✅ 模型分配成功:', data)
            setModelId(data.model_id)
            let id = currentConversation?.id

            // 连接成功后自动创建对话
            if (!currentConversation) {
                id = createNewConversation()
            }

            addMessage({
                content: `已连接并分配到模型 ${data.model_id}，对话ID: ${id}`,
                isUser: false,
            })
            setLoading(false)
        })

        // 模型繁忙
        socketRef.current.on('waiting_for_model', (data) => {
            console.log('模型繁忙:', data)
            setLoading(false)
            addMessage({
                content: data.message || '模型池繁忙，正在排队中……',
                isUser: false,
                isError: true,
            })
        })

        // 模型响应
        socketRef.current.on('model_response', (data) => {
            console.log('收到模型响应:', data)
            addMessage({
                content: data.result || '模型响应为空',
                isUser: false,
            })
            setLoading(false)
        })

        // 流式token响应（如果后端支持）
        socketRef.current.on('new_token', (data) => {
            console.log('收到新token:', data)
            setLoading(false)
            // 这里可以实现流式显示
            if (modelIdRef.current && data.token) {
                if (data.token === '<|...|>') {
                    // 结束这一条，并且加上...
                    setMessages(prev => prev.map((message, index) => ({
                        ...message,
                        content: index === prev.length - 1 ? message.content + '...' : message.content,
                        end: index === prev.length - 1 ? true : false,
                    })))
                    return;
                }
                if (data.token === '<|silence|>') {
                    // 给上一条消息加上结束标识
                    setMessages(prev => prev.map((message, index) => ({
                        ...message,
                        end: index === prev.length - 1 ? true : false,
                    })))
                    return;
                }
                // 如果上一条是用户消息，直到收到<|round_start|>再开启token的接收
                if (messagesRef.current[messagesRef.current.length - 1].isUser) {
                    if (data.token === '<|round_start|>') {
                        setMessages(prev => prev.map((message, index) => ({
                            ...message,
                            end: index === prev.length - 1 ? true : false,
                        })))
                        return;
                    }
                }
                // 如果没有消息或上一条消息有结束标识，则创建一条新消息
                if (
                    messagesRef.current.length === 0 ||
                    messagesRef.current[messagesRef.current.length - 1].end
                ) {
                    addMessage({
                        content: data.token,
                        isUser: false,
                    })
                } else {
                    // 把这条token连接在message最后
                    setMessages(prev => prev.map((message, index) => ({
                        ...message,
                        content: index === prev.length - 1 ? message.content + data.token : message.content,
                    })))
                }
            }
        })

        // 连接断开
        socketRef.current.on('disconnect', () => {
            console.log('WebSocket 连接断开')
            setIsConnected(false)
            setModelId(null)
        })

        // 错误处理
        socketRef.current.on('error', (error) => {
            console.error('WebSocket错误:', error)
            addMessage({
                content: error.message || '连接出现问题，请稍后重试',
                isUser: false,
                isError: true,
            })
            setLoading(false)
        })

        // 连接错误
        socketRef.current.on('connect_error', (error) => {
            console.error('连接错误:', error)
            setIsConnected(false)
            if (!messagesRef.current[messagesRef.current.length - 1].isError) {
                addMessage({
                    content: '无法连接到后端服务，请检查服务是否启动',
                    isUser: false,
                    isError: true,
                })
            }
        })
    }

    // 统一的发送消息方法
    const sendMessage = (content: string, files: File[] = []) => {
        if (!currentConversation) {
            createNewConversation()
        }

        // 添加用户消息
        let displayContent = content
        if (files.length > 0) displayContent += ' [包含文件]'
        if (isVideoStreaming) displayContent += ' [含视频流]'

        addMessage({
            content: displayContent,
            isUser: true,
        })

        setLoading(true)

        if (socketRef.current && isConnected) {
            try {
                if (content.trim() !== '') {
                    // 统一使用 send_message 事件
                    socketRef.current.emit('send_message', {
                        message: content,
                    })
                }

                if (files.length > 0) {
                    for (const file of files) {
                        if (file.type.startsWith('image/')) {
                            socketRef.current.emit('send_image', {
                                image: file,
                            })
                        } else if (file.type.startsWith('video/')) {
                            socketRef.current.emit('send_video', {
                                video: file,
                            })
                        }
                    }
                }
            } catch (error) {
                console.error('发送消息失败:', error)
                addMessage({
                    content: '发送消息失败，请重试',
                    isUser: false,
                    isError: true,
                })
                setLoading(false)
            }
        } else {
            addMessage({
                content: '未连接到服务器，请检查连接状态',
                isUser: false,
                isError: true,
            })
            setLoading(false)
        }
    }

    // 占满除了SideBar的区域
    return <div className="h-screen w-full pt-10 pl-4 pr-4 pb-5">
        <div className="flex flex-row items-center justify-between">
            <SidebarTrigger style={{ backgroundColor: 'transparent' }} />
            <div className="font-bold">离线视频理解</div>
            <Badge variant={isConnected ? "default" : "destructive"} className="justify-center">
                {isConnected ? (
                    <>
                        <Wifi className="h-4 w-4 mr-2" />
                        已连接到服务器
                    </>
                ) : (
                    <>
                        <WifiOff className="h-4 w-4 mr-2" />
                        连接中...
                    </>
                )}
            </Badge>
        </div>
        <Separator />
        <ChatContext.Provider value={{ socketRef, isConnected, messages, addMessage, loading, sendMessage, isVideoStreaming, setIsVideoStreaming, videoStreamType, setVideoStreamType }}>
            {type === SidebarKey.Chat && <Chat />}
            {type === SidebarKey.Stream && <Stream />}
        </ChatContext.Provider>
    </div>
}

export default ChatView