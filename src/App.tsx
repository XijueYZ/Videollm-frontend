import { useEffect, useRef, useState } from "react"
import { ChatContext, defaultItems, SidebarKey } from "./utils"
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import Chat from "./pages/Chat"
import Stream from "./pages/Stream"
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar"
import { Badge } from "./components/ui/badge"
import { Wifi, WifiOff } from "lucide-react"
import { Separator } from "./components/ui/separator"
import LeftSideBar from "./pages/Sidebar"
import './App.css'
import useWebSocketData, { webSocketStore } from "./WebSocketStore"

// TODO: 使用当前域名
const socketUrl = '/' // 空字符串会使用当前域名
// 获得当前url的pathname
const pathname = window.location.pathname
console.log('当前url的pathname:', pathname)
// 去掉最后两个/之间的内容

const path = pathname.split('/').slice(0, -2).join('/')
console.log('当前url的path:', path)
// 拼接socketUrl
const socketPath = path + '/5000/socket.io'
// const socketPath = '/';

const App: React.FC = () => {
  const [activeKey, setActiveKey] = useState(SidebarKey.Stream)
  const [isConnected, setIsConnected] = useState(false)
  const [modelId, setModelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isVideoStreaming, setIsVideoStreaming] = useState(false);
  const [videoStreamType, setVideoStreamType] = useState<string | null>(null);

  const messages = useWebSocketData()
  const modelIdRef = useRef(modelId)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    modelIdRef.current = modelId
  }, [modelId])

  // 切换页面时，清空消息
  useEffect(() => {
    webSocketStore.clearMessages();
    setCurrentConversation(null)
    setIsVideoStreaming(false)
    setVideoStreamType(null)
  }, [activeKey])


  useEffect(() => {
    initSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  useEffect(() => {
    if (socketRef.current && activeKey) {
      socketRef.current.emit('request_model', {
        activeKey: activeKey,
      })
    }
  }, [activeKey])

  // 开启新对话
  const createNewConversation = () => {
    const id = uuidv4()
    setCurrentConversation({
      id: id,
      title: 'AI对话',
      createdAt: new Date().toISOString(),
    })
    webSocketStore.clearMessages();
    return id;
  }

  // 消息管理
  const addMessage = (message: Partial<Message>) => {
    const newMessage = {
      ...message,
      id: uuidv4(),
      content: message.content,
      timestamp: Date.now(),
      isError: message.isError || false,
    } as Message
    webSocketStore.addMessage(newMessage)
  }

  const initSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    socketRef.current = io(socketUrl, {
      path: socketPath,
      transports: ['websocket', 'polling'], // 添加备选传输方式
      timeout: 10000,
      forceNew: true,
      autoConnect: true,
    })

    // 连接成功
    socketRef.current.on('connect', () => {
      console.log('WebSocket 连接成功', socketRef.current)
      setIsConnected(true)
      socketRef.current?.emit('request_model', {
        activeKey: activeKey,
      })
    })

    // 模型分配中
    socketRef.current.on('model_assigning', (data) => {
      console.log('⏳ 模型分配中:', data)
      setLoading(true)
      addMessage({
        content: data.message,
        isUser: false,
      })
    })

    // 模型分配成功
    socketRef.current.on('model_assigned', (data) => {
      console.log('✅ 模型分配成功:', data)
      setModelId(data.model_id)
      setLoading(false)

      if (!currentConversation) {
        createNewConversation()
      }

      addMessage({
        content: `模型 ${data.model_id} 分配成功！`,
        isUser: false,
      })
    })

    // 模型分配失败
    socketRef.current.on('model_assign_failed', (data) => {
      console.log('❌ 模型分配失败:', data)
      setLoading(false)
      addMessage({
        content: data.message,
        isUser: false,
        isError: true,
      })
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

    console.log('messages:', messages)
    // 流式token响应（如果后端支持）
    socketRef.current.on('new_token', (data) => {
      console.log('收到新token:', data)
      setLoading(false)
      // 这里可以实现流式显示
      if (modelIdRef.current && data.token) {
        if (data.token === '<|...|>') {
          // 结束这一条，并且加上...
          webSocketStore.updateMessages((messages) => 
            messages.map((message, index) => ({
              ...message,
              content: index === messages.length - 1 ? message.content + '...' : message.content,
              end: index === messages.length - 1 ? true : false,
              isUser: false,
            }))
          )
          return;
        }
        if (data.token === '<|silence|>') {
          // 给上一条消息加上结束标识
          webSocketStore.updateMessages((messages) => 
            messages.map((message, index) => ({
              ...message,
              end: index === messages.length - 1 ? true : false,
            }))
          )
          return;
        }
        const currentMessages = webSocketStore.getSnapshot()
        console.log('当前messages:', currentMessages)
        // 如果上一条是用户消息，直到收到<|round_start|>再开启token的接收
        if (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].isUser && !currentMessages[currentMessages.length - 1].end) {
          if (data.token === '<|round_start|>') {
            webSocketStore.updateMessages((messages) => 
              messages.map((message, index) => ({
                ...message,
                end: index === messages.length - 1 ? true : false,
              }))
            )
            return;
          }
          return;
        }
        // 如果没有消息或上一条消息有结束标识，则创建一条新消息
        if (
          currentMessages.length === 0 ||
          currentMessages[currentMessages.length - 1].end
        ) {
          addMessage({
            content: data.token,
            isUser: false,
          })
        } else {
          // 把这条token连接在message最后
          webSocketStore.updateMessages((messages) => 
            messages.map((message, index) => ({
              ...message,
              content: index === messages.length - 1 ? message.content + data.token : message.content,
            }))
          )
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
      const currentMessages = webSocketStore.getSnapshot()
      if (!currentMessages?.length || !currentMessages[currentMessages.length - 1].isError) {
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
  return <div className="h-screen w-full">
    <SidebarProvider>
      <LeftSideBar items={defaultItems} activeKey={activeKey} setActiveKey={setActiveKey} />
      <div className="flex-1 flex flex-col min-w-0">
        <ChatContext.Provider value={{ socketRef, isConnected, messages, addMessage, loading, sendMessage, isVideoStreaming, setIsVideoStreaming, videoStreamType, setVideoStreamType }}>

          <div className="h-full w-full pt-2 pl-4 pr-4 pb-0 flex flex-col" style={{ height: '100vh' }}>
            <div className="flex flex-row items-center justify-between flex-0">
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
            {activeKey === SidebarKey.Chat && <Chat />}
            {activeKey === SidebarKey.Stream && <Stream />}
          </div>
        </ChatContext.Provider>
      </div>
    </SidebarProvider>
  </div>
}

export default App