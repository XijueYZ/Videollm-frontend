import { useEffect, useMemo, useRef, useState } from "react"
import { ChatContext, defaultItems, SidebarKey } from "./utils"
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import Chat from "./pages/Chat"
import Stream from "./pages/Stream"
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar"
import { Badge } from "./components/ui/badge"
import { Settings, Wifi, WifiOff, History, Plus, Trash2 } from "lucide-react"
import { Separator } from "./components/ui/separator"
import LeftSideBar from "./pages/Sidebar"
import './App.css'
import useWebSocketData, { useActiveKey, webSocketStore } from "./WebSocketStore"
import { Button } from "./components/ui/button"
import { apiCall, apiCallWithAbort } from "./service"
import { toast } from "sonner"

// TODO: 使用当前域名
// const socketUrl = '/' // 空字符串会使用当前域名
const socketUrl = 'ws://localhost:5000'
// 获得当前url的pathname
const pathname = window.location.pathname
console.log('当前url的pathname:', pathname)
// 去掉最后两个/之间的内容

export const path = pathname.split('/').slice(0, -2).join('/')
console.log('当前url的path:', path)
// 拼接socketUrl
// TODO:
// const socketPath = path + '/5000/socket.io'

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
  const [isAllocatingModel, setIsAllocatingModel] = useState(false)

  // 对话历史相关状态
  const [currentConversationId, setCurrentConversationId] = useState<string>()
  const [conversations, setConversations] = useState<any[]>([])

  const messages = useWebSocketData()
  const modelIdRef = useRef(modelId)
  const socketRef = useRef<Socket | null>(null)
  const activeKeyRef = useRef(activeKey)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    modelIdRef.current = modelId
  }, [modelId])

  useEffect(() => {
    activeKeyRef.current = activeKey
  }, [activeKey])

  // 切换页面时，清空消息
  useEffect(() => {
    setIsVideoStreaming(false);
    setVideoStreamType(null);
    clearConversation();
  }, [activeKey])

  useEffect(() => {
    if (isConnected) {
      loadConversations()
    }
  }, [isConnected])


  useEffect(() => {
    initSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

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

  // 加载对话列表
  const loadConversations = async () => {
    try {
      const data = await apiCall(`/api/conversations`)
      if (data.success) {
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('加载对话列表失败:', error)
    }
  }

  // 新建对话界面
  const clearConversation = async () => {
    // 释放模型
    if (modelId) {
      await apiCall('/api/release-model', {
        method: 'POST',
        body: JSON.stringify({
          sid: socketRef.current?.id
        })
      })
    } else if (abortControllerRef.current) {
      cancelModelAllocation();
    }
    setModelId(null);
    setCurrentConversationId(undefined)
    webSocketStore.clearMessages()
  }

  // 创建新对话
  const createNewConversation = async (title: string) => {
    try {
      const data = await apiCall('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          title: title,
          type: activeKey
        })
      })

      if (data.success) {
        setCurrentConversationId(data.conversationId)
        await loadConversations() // 重新加载对话列表
        console.log('新对话创建成功:', data.conversationId)
        return data.conversationId
      }
    } catch (error) {
      console.error('创建对话失败:', error)
    }
  }

  // 加载指定对话
  const loadConversation = async (conversationId: string) => {
    try {
      const data = await apiCall(`/api/conversations/${conversationId}/messages`)
      if (data.success) {
        setCurrentConversationId(conversationId)
        // 清空当前消息并加载历史消息
        webSocketStore.clearMessages()
        data.messages.forEach((msg: any) => {
          webSocketStore.addMessage({
            id: msg.id,
            content: msg.content,
            isUser: msg.type === 'user',
            isError: msg.isError,
            timestamp: msg.timestamp,
            history_files: msg.files ? JSON.parse(msg.files) : undefined,
          })
        })
        webSocketStore.addMessage({
          historySeperator: true,
          id: uuidv4(),
        })
      }
    } catch (error) {
      console.error('加载对话失败:', error)
    }
  }

  // 删除对话
  const deleteConversation = async (conversationId: string) => {
    console.log(conversationId);
    try {
      await apiCall(`/api/conversations/${conversationId}`, {
        method: 'DELETE'
      })

      // 如果删除的是当前对话，清空当前对话
      if (currentConversationId === conversationId) {
        clearConversation();
      }

      await loadConversations() // 重新加载对话列表
      console.log('对话删除成功:', conversationId)
    } catch (error) {
      console.error('删除对话失败:', error)
    }
  }

  // 新增对话内容
  const updateConversationContent = async (conversationId: string, message: Pick<Message, 'content' | 'isUser' | 'isError'>) => {
    try {
      await apiCall(`/api/conversations/${conversationId}/content`, {
        method: 'PUT',
        body: JSON.stringify({
          content: message.content,
          is_user: message.isUser,
          is_error: message.isError,
        })
      })
    }
    catch (error) {
      console.error('更新对话内容失败:', error)
    }
  }

  // 必须有Message里面的几个关键字
  const recordDialogue = (message: Pick<Message, 'content' | 'isUser' | 'isError'>, conversationId?: string) => {
    const id = conversationId || currentConversationId;
    if (!id) return;
    // 把数据发给后端
    try {
      updateConversationContent(id, message)
    }
    catch (error) {
      console.error('更新对话内容失败:', error)
    }
  }


  const initSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    socketRef.current = io(socketUrl, {
      // path: socketPath,
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

    // 流式token响应（如果后端支持）
    socketRef.current.on('new_token', (data) => {
      if (activeKeyRef.current === SidebarKey.Stream) {
        console.log('[实时]收到新token:', data)

        // 这里可以实现流式显示
        if (modelIdRef.current && data.token) {
          const currentMessages = webSocketStore.getSnapshot()
          const lastMessage = currentMessages?.length > 0 ? currentMessages?.[currentMessages?.length - 1] : undefined;
          // 如果现在还没有任何消息（用户也没有发），不接收token
          if (currentMessages?.length === 0) return;
          if (data.token === "<|eot_id|>") return;
          // 收到...
          if (data.token === '<|...|>') {
            // 上一条后端返回的
            if (lastMessage && !lastMessage.isUser) {
              recordDialogue({
                ...lastMessage,
                content: lastMessage.content + '...',
                isUser: false,
              })
              // 收到...则结束这一条，并且加上...
              webSocketStore.updateLastMessage((message) =>
              ({
                ...message,
                content: message.content + '...',
                end: true,
                isUser: false,
              })
              )
            }
            // 上一条是用户信息则直接跳过
            return;
          }
          // 收到silence则结束当条
          if (data.token === '<|silence|>') {
            // 上一条后端返回的
            if (lastMessage && !lastMessage.isUser) {
              recordDialogue(lastMessage)
              webSocketStore.updateLastMessage((message) => ({
                ...message,
                // 最后一条加上结束标识
                end: true
              }))
            }
            // 上一条是用户信息则直接跳过
            return;
          }
          // 直到收到<|round_start|>再开启token的接收
          console.log('当前messages:', currentMessages)
          if (data.token === '<|round_start|>') {
            webSocketStore.updateLastMessage((message) => ({
              ...message,
              // 上一条改成end=True，如果是用户的消息标识可以开始接收；如果是后端的消息标识这一条已经结束
              end: true
            }))
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
            if (lastMessage && lastMessage.loading) {
              webSocketStore.updateLastMessage((message) => ({
                ...message,
                content: data.token,
                loading: false,
              }))
            } else if (!lastMessage || lastMessage.end) {
              addMessage({
                content: data.token,
                isUser: false,
              })
            } else {
              // 把这条token连接在message最后
              webSocketStore.updateLastMessage((message) =>
              ({
                ...message,
                content: message.content + data.token,
              })
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
            if (lastMessage) {
              recordDialogue(lastMessage)
            }
            setIsChatOutputting(false)
            webSocketStore.updateLastMessage((message) =>
            ({
              ...message,
              // 上一条改成end=True，标识可以开始token的接收了
              end: true,
            })
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
            } else if (lastMessage?.loading) {
              webSocketStore.updateLastMessage((message) => ({
                ...message,
                content: data.token,
                loading: false,
              }))
            } else {
              // 把这条token连接在message最后
              webSocketStore.updateLastMessage((message) =>
              ({
                ...message,
                content: message.content + data.token,
              })
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

  // HTTP分配模型，允许中途取消
  const allocateModel = async (conversationId: string) => {
    try {
      // 创建新的AbortController
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const data = await apiCallWithAbort('/api/allocate-model', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: conversationId,
          activeKey: activeKey,
          sid: socketRef.current?.id
        }),
        signal: abortController.signal
      })

      if (data.success) {
        setModelId(data.modelId)
        console.log('模型分配成功:', data.modelId)
        return true
      } else {
        return false
      }
    } catch (error) {
      if (error instanceof Error && error.message === '请求已取消') {
        console.log('模型分配请求已取消')
        return false
      }
      console.error('分配模型失败:', error)
      return false
    } finally {
      abortControllerRef.current = null
    }
  }

  // 取消模型分配
  const cancelModelAllocation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      // 移除加载中的消息
      webSocketStore.deleteLastMessage()
    }
  }

  // 修改sendMessage函数，在发送消息前检查并分配模型
  const sendMessage = async (
    content: string,
    files: (File | VideoDataType)[] = [],
    type: SidebarKey,
    otherParams: Record<string, any> | undefined = {}
  ) => {
    let conversationId = currentConversationId
    // 检查是否有当前对话
    if (!currentConversationId) {
      // 创建对话
      conversationId = await createNewConversation(content.slice(0, 10) || (files.length > 0 ? '[文件消息]' : '新对话'))
    }
    if (!conversationId) {
      toast("对话创建异常", {
        description: "请刷新或创建新对话",
      })
      return;
    }
    // 如果上一条还没有end，则先保存一下上一条的结果
    const currentMessages = webSocketStore.getSnapshot()
    const lastMessage = currentMessages?.length > 0 ? currentMessages?.[currentMessages?.length - 1] : undefined;
    if (lastMessage && !lastMessage.end && !lastMessage.loading) {
      recordDialogue(lastMessage)
    } else if (lastMessage?.loading) {
      // 把上一条删了
      webSocketStore.deleteLastMessage()
    }
    // 添加用户消息
    const displayContent = content
    addMessage({
      content: displayContent,
      files: files.map((item) => item.type.startsWith('video/') ? (item as VideoDataType)?.file : item as File),
      isUser: true,
    })

    if (!modelId) {
      addMessage({
        loading: true,
        isUser: false,
      })
      setIsAllocatingModel(true)
      const success = await allocateModel(conversationId);
      setIsAllocatingModel(false)
      if (!success) {
        webSocketStore.updateLastMessage((message) => ({
          ...message,
          loading: false,
          content: '模型繁忙中，请稍后重试',
        }))
        // 记录一下这条消息
        recordDialogue({
          content: displayContent,
          isUser: true,
          isError: false
        }, conversationId)
        return;
      }
    }

    if (socketRef.current && isConnected) {
      try {
        if (files.length > 0) {
          const imageFiles = files.filter(file => file.type.startsWith('image/'))
          const videoFiles = files.filter(file => file.type.startsWith('video/'))

          console.log('发送文件:', {
            images: imageFiles.length,
            videos: videoFiles.length,
            videoPaths: videoFiles
          })

          socketRef.current.emit('send_data', {
            conversationId: conversationId, // 添加conversationId
            images: imageFiles, // 图片直接发送File对象
            videos: videoFiles, // 视频只发送路径信息
            message: content,
            type: type,
            params: otherParams
          })
        } else {
          socketRef.current.emit('send_data', {
            conversationId: conversationId, // 添加conversationId
            message: content,
            type: type,
            params: otherParams
          })
        }
      } catch (error) {
        console.error('发送消息失败:', error)
        addMessage({
          content: error instanceof Error ? error.message : '发送消息失败，请重试',
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

  const sidebarItems = useMemo(() => defaultItems.map(item => ({
    ...item,
    conversations: conversations.filter(conv => conv.type === item.key),
    onLoadConversation: loadConversation,
    onDeleteConversation: deleteConversation,
    onClearConversation: clearConversation,
    currentConversationId: currentConversationId
  })), [conversations, currentConversationId])

  // 占满除了SideBar的区域
  return <div className="h-screen w-full overflow-clip">
    <SidebarProvider>
      <LeftSideBar items={sidebarItems} />
      <div className="flex-1 flex flex-col min-w-0">
        <ChatContext.Provider value={{ socketRef, isConnected, messages, addMessage, sendMessage, isVideoStreaming, setIsVideoStreaming, videoStreamType, setVideoStreamType, isAllocatingModel }}>

          <div className="h-screen w-full pt-2 pl-4 pr-4 pb-0 flex flex-col">
            <div className="flex flex-row items-center justify-between flex-0 align-middle">
              <div className="flex flex-row items-center">
                <SidebarTrigger />
                <div className="font-bold">{activeKey === SidebarKey.Chat ? "Chat Prompt" : "Stream realtime"}</div>
                {currentConversationId && (
                  <Badge variant="outline" className="ml-2">
                    对话: {conversations.find(c => c.id === currentConversationId)?.title || '未知'}
                  </Badge>
                )}
              </div>
              <div className="flex flex-row items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearConversation}
                  className="h-[28px]"
                >
                  <Plus className="h-4 w-4" />
                </Button>
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