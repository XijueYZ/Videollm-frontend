import { useEffect, useRef, useState } from "react"
import { ChatContext, defaultItems, SidebarKey } from "./utils"
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import Chat from "./pages/Chat"
import Stream from "./pages/Stream"
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar"
import { Badge } from "./components/ui/badge"
import { Settings, Wifi, WifiOff } from "lucide-react"
import { Separator } from "./components/ui/separator"
import LeftSideBar from "./pages/Sidebar"
import './App.css'
import useWebSocketData, { useActiveKey, webSocketStore } from "./WebSocketStore"
import { Button } from "./components/ui/button"

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
  // 从Store获取activeKey，而不是本地state
  const activeKey = useActiveKey()
  const [isConnected, setIsConnected] = useState(false)
  const [modelId, setModelId] = useState<string | null>(null)
  const [isVideoStreaming, setIsVideoStreaming] = useState(false);
  const [videoStreamType, setVideoStreamType] = useState<string | null>(null);
  const [collapseSettings, setCollapseSettings] = useState(false)
  // chat场景，正在输出
  const [isChatOutputting, setIsChatOutputting] = useState(false)

  const messages = useWebSocketData()
  const modelIdRef = useRef(modelId)
  const socketRef = useRef<Socket | null>(null)
  const isAssigningRef = useRef<boolean>(false);
  const activeKeyRef = useRef(activeKey)

  useEffect(() => {
    modelIdRef.current = modelId
  }, [modelId])

  useEffect(() => {
    activeKeyRef.current = activeKey
  }, [activeKey])

  // 切换页面时，清空消息
  useEffect(() => {
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
    console.log(activeKey)
    if (isConnected) {
      socketRef?.current?.emit('request_model', {
        activeKey: activeKey,
      })
    }
  }, [activeKey, isConnected])

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
    })

    // 模型分配中
    socketRef.current.on('model_assigning', () => {
      isAssigningRef.current = true
    })

    // 模型分配成功
    socketRef.current.on('model_assigned', (data) => {
      console.log('✅ 模型分配成功:', data)
      setModelId(data.model_id)
      isAssigningRef.current = false

      webSocketStore.setIsSwitchingType(false);
    })

    // 模型分配失败
    socketRef.current.on('model_assign_failed', (data) => {
      console.log('❌ 模型分配失败:', data)
      isAssigningRef.current = false
      setModelId(null);
    })

    // 有模型空出来了
    socketRef.current.on('has_model_released', () => {
      if (!modelIdRef.current && !isAssigningRef.current) {
        socketRef.current?.emit('request_model', {
          activeKey: activeKey,
        })
      }
    })

    // 流式token响应（如果后端支持）
    socketRef.current.on('new_token', (data) => {
      // 如果正在切换模型，则不处理中间输出的这些token
      if (webSocketStore.getIsSwitchingType()) {
        return;
      }
      if (activeKeyRef.current === SidebarKey.Stream) {
        console.log('[实时]收到新token:', data)
        // 这里可以实现流式显示
        if (modelIdRef.current && data.token) {
          const currentMessages = webSocketStore.getSnapshot()
          const lastMessage = currentMessages?.length > 0 ? currentMessages?.[currentMessages?.length - 1] : undefined;
          // 收到...
          if (data.token === '<|...|>') {
            // 上一条后端返回的
            if (lastMessage && !lastMessage.isUser) {
              // 收到...则结束这一条，并且加上...
              webSocketStore.updateMessages((messages) =>
                messages.map((message, index) => ({
                  ...message,
                  content: index === messages.length - 1 ? message.content + '...' : message.content,
                  end: index === messages.length - 1 ? true : false,
                  isUser: false,
                }))
              )
            }
            // 上一条是用户信息则直接跳过
            return;
          }
          // 收到silence则结束当条
          if (data.token === '<|silence|>') {
            // 上一条后端返回的
            if (lastMessage && !lastMessage.isUser) {
              webSocketStore.updateMessages((messages) =>
                messages.map((message, index) => ({
                  ...message,
                  // 最后一条加上结束标识
                  end: index === messages.length - 1 ? true : message.end
                }))
              )
            }
            // 上一条是用户信息则直接跳过
            return;
          }
          // 直到收到<|round_start|>再开启token的接收
          console.log('当前messages:', currentMessages)
          if (data.token === '<|round_start|>') {
            webSocketStore.updateMessages((messages) =>
              messages.map((message, index) => ({
                ...message,
                // 上一条改成end=True，如果是用户的消息标识可以开始接收；如果是后端的消息标识这一条已经结束
                end: index === messages.length - 1 ? true : message.end,
              }))
            )
            return;
          }
          if (lastMessage && lastMessage.isUser) {
            if (lastMessage?.end) {
              // end=True，标识收到过round_start，开启新的一条
              addMessage({
                content: data.token,
                isUser: false,
              })
              return;
            } else {
              return;
            }

          } else {
            // 还没有数据，或上一条后端返回的已经结束，开启新的一条
            if (!lastMessage || lastMessage.end) {
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
        }
      } else if (activeKeyRef.current === SidebarKey.Chat) {
        console.log('[离线]收到新token:', data)
        // 这里可以实现流式显示
        if (modelIdRef.current && data.token) {
          const currentMessages = webSocketStore.getSnapshot()
          const lastMessage = currentMessages?.length > 0 ? currentMessages?.[currentMessages?.length - 1] : undefined;
          if (data.token === "<|eot_id|>") return;
          // 如果收到round_end，代表后端输出完毕，用户可以继续输出
          if (data.token === '<|round_end|>') {
            setIsChatOutputting(false)
            webSocketStore.updateMessages((messages) =>
              messages.map((message, index) => ({
                ...message,
                // 上一条改成end=True，标识可以开始token的接收了
                end: index === messages.length - 1 ? true : message.end,
              }))
            )
            return;
          } else {
            setIsChatOutputting(true)
            console.log('当前messages:', currentMessages)
            if (lastMessage && lastMessage.isUser || !lastMessage) {
              // 上一条是用户信息，则直接添加新的一条
              addMessage({
                content: data.token,
                isUser: false,
              })
              return;
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
    })

    // 连接错误
    socketRef.current.on('connect_error', (error) => {
      console.error('连接错误:', error)
      setIsConnected(false)
    })
  }

  // 统一的发送消息方法
  const sendMessage = async (content: string, files: File[] = [], type: SidebarKey, otherParams: Record<string, any> | undefined = {}) => {
    // 添加用户消息
    const displayContent = content
    addMessage({
      content: displayContent,
      files: files,
      isUser: true,
    })

    if (socketRef.current && isConnected) {
      try {
        if (files.length > 0) {
          // 将文件转换为base64或ArrayBuffer
          const processedFiles = await Promise.all(
            files.map(async (file) => {
              return new Promise((resolve, reject) => {
                const reader = new FileReader()
                
                reader.onload = () => {
                  resolve({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: reader.result, // base64 string
                  })
                }
                
                reader.onerror = () => {
                  reject(new Error(`读取文件失败: ${file.name}`))
                }
                
                // 使用readAsDataURL获取base64，或者readAsArrayBuffer获取二进制数据
                reader.readAsDataURL(file)
              })
            })
          )

          // 分别处理图片和视频
          const imageFiles = processedFiles.filter((file: any) => typeof file.type === 'string' && file.type.startsWith('image/'))
          const videoFiles = processedFiles.filter((file: any) => typeof file.type === 'string' && file.type.startsWith('video/'))

          console.log('发送文件数据:', { imageFiles: imageFiles.length, videoFiles: videoFiles.length })
          socketRef.current.emit('send_data', {
            images: imageFiles,
            videos: videoFiles,
            message: content,
            type: type,
            params: otherParams
          })
        } else {
          socketRef.current.emit('send_data', {
            message: content,
            type: type,
            params: otherParams
          })
        }
      } catch (error) {
        console.error('发送消息失败:', error)
        addMessage({
          content: '发送消息失败，请重试',
          isUser: false,
          isError: true,
        })
      }
    } else {
      addMessage({
        content: '未连接到服务器，请检查连接状态',
        isUser: false,
        isError: true,
      })
    }
  }

  // 占满除了SideBar的区域
  return <div className="h-screen w-full overflow-clip">
    <SidebarProvider>
      <LeftSideBar items={defaultItems}/>
      <div className="flex-1 flex flex-col min-w-0">
        <ChatContext.Provider value={{ socketRef, isConnected, messages, addMessage, sendMessage, isVideoStreaming, setIsVideoStreaming, videoStreamType, setVideoStreamType }}>

          <div className="h-screen w-full pt-2 pl-4 pr-4 pb-0 flex flex-col">
            <div className="flex flex-row items-center justify-between flex-0 align-middle">
              <SidebarTrigger />
              <div className="font-bold">{activeKey === SidebarKey.Chat ? "Chat Prompt" : "Stream realtime"}</div>
              <div className="flex flex-row items-center justify-center">
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
                {collapseSettings &&
                  <Button className="h-[28px]" variant="ghost" size="sm" onClick={() => setCollapseSettings(false)}>
                    {/* 设置icon */}
                    <Settings />
                  </Button>}
              </div>
            </div>
            <Separator />
            {activeKey === SidebarKey.Chat && <Chat collapseSettings={collapseSettings} setCollapseSettings={setCollapseSettings} isChatOutputting={isChatOutputting} />}
            {activeKey === SidebarKey.Stream && <Stream />}
          </div>
        </ChatContext.Provider>
      </div>
    </SidebarProvider>
  </div>
}

export default App