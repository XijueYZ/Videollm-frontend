import { useEffect, useRef, useState } from "react"
import { ChatContext, SidebarKey } from "./utils"
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import Chat from "./pages/Chat"

type Props = {
    type: SidebarKey
}

const socketUrl = 'ws://localhost:5000';

const ChatView: React.FC<Props> = ({ type }) => {
    // TODO: 连接状态需要从后端获取
    const [isConnected, setIsConnected] = useState(false)
    const [modelId, setModelId] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false);
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)

    const socketRef = useRef<Socket | null>(null)

    useEffect(() => {
        initSocket()
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

        setMessages([...messages, newMessage])
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
            console.log("modelId", modelId, "data.token", data.token)
            if (modelId && data.token && data.token !== '[DONE]') {
                // 可以累积token或实时显示
                // 如果上一条是用户消息或者没有消息，则创建一条新消息
                if (messages.length === 0 || messages[messages.length - 1].isUser) {
                    console.log('添加新消息', messages)
                    addMessage({
                        content: data.token,
                        isUser: false,
                    })
                } else {
                    // 把这条token连接在message最后
                    messages[messages.length - 1].content += data.token
                    setMessages([...messages])
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
            if (!messages[messages.length - 1].isError) {
                addMessage({
                    content: '无法连接到后端服务，请检查服务是否启动',
                    isUser: false,
                    isError: true,
                })
            }
        })
    }
    // 占满除了SideBar的区域
    return <div className="h-screen w-full pt-10 pl-4 pr-4 pb-5">
        <ChatContext.Provider value={{ socketRef, isConnected, messages, setMessages, loading }}>
            {type === SidebarKey.Chat && <Chat />}
            {type === SidebarKey.Stream && <div>Stream</div>}
        </ChatContext.Provider>
    </div>
}

export default ChatView