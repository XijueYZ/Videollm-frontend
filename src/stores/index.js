import { defineStore } from 'pinia'
import { io } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'

export const useChatStore = defineStore('chat', {
  state: () => ({
    // 当前对话
    currentConversation: null,
    messages: [],
    isLoading: false,

    // 对话历史 - 注释掉历史记录功能
    // conversations: [],

    // WebSocket连接 - 修改为连接 localhost:5000
    socket: null,
    isConnected: false,
    modelId: null, // 存储分配的模型ID

    // 视频流状态
    isVideoStreaming: false,
    currentVideoStream: null,
    currentVideoFrame: null, // 添加当前视频帧缓存
    videoStreamType: null, // 'camera' | 'screen'

    // UI状态 - 默认显示侧边栏
    sidebarVisible: true,
  }),

  getters: {
    // 注释掉历史记录相关的 getter
    // groupedConversations: (state) => {
    //   const groups = {}
    //   const now = dayjs()
    //   state.conversations.forEach((conv) => {
    //     const date = dayjs(conv.updatedAt)
    //     const daysAgo = now.diff(date, 'day')
    //     let groupKey
    //     if (daysAgo === 0) {
    //       groupKey = '今天'
    //     } else if (daysAgo === 1) {
    //       groupKey = '昨天'
    //     } else if (daysAgo <= 7) {
    //       groupKey = '7天内'
    //     } else if (daysAgo <= 30) {
    //       groupKey = '30天内'
    //     } else {
    //       groupKey = '更早'
    //     }
    //     if (!groups[groupKey]) {
    //       groups[groupKey] = []
    //     }
    //     groups[groupKey].push(conv)
    //   })
    //   return groups
    // },
  },

  actions: {
    // WebSocket连接管理 - 修改为连接后端模型服务
    initSocket() {
      if (this.socket) {
        this.socket.disconnect()
      }
      const socketUrl = 'ws://localhost:5000'
      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'], // 添加备选传输方式
        timeout: 10000,
        forceNew: true,
        autoConnect: true,
      })

      // 连接成功
      this.socket.on('connect', () => {
        console.log('WebSocket 连接成功')
        this.isConnected = true
      })

      // 连接确认，获取分配的模型ID
      // 在 initSocket() 方法中的 'connected' 事件处理器里修改：
      this.socket.on('connected', (data) => {
        console.log('✅ 模型分配成功:', data)
        this.modelId = data.model_id

        // 连接成功后自动创建对话
        if (!this.currentConversation) {
          this.createNewConversation()
        }

        this.addMessage({
          content: `已连接并分配到模型 ${data.model_id}，对话ID: ${this.currentConversation.id}`,
          isUser: false,
          end: true,
        })
        this.setLoading(false)
      })

      // 模型繁忙
      this.socket.on('waiting_for_model', (data) => {
        console.log('模型繁忙:', data)
        this.setLoading(false)
        this.addMessage({
          content: data.message || '模型池繁忙，正在排队中……',
          isUser: false,
          isError: true,
        })
      })

      // 模型响应
      this.socket.on('model_response', (data) => {
        console.log('收到模型响应:', data)
        this.addMessage({
          content: data.result || '模型响应为空',
          isUser: false,
        })
        this.setLoading(false)
      })

      // 流式token响应（如果后端支持）
      this.socket.on('new_token', (data) => {
        console.log('收到新token:', data)
        this.setLoading(false)
        // 这里可以实现流式显示
        if (this.modelId && data.token) {
          if (data.token === '<|...|>') {
            // 结束这一条，并且加上...
            this.messages[this.messages.length - 1].content += '...'
            this.messages[this.messages.length - 1].end = true
            return;
          }
          // TODO:
          if (data.token === '<|silence|>') {
            this.messages[this.messages.length - 1].end = true
            return;
          }
          // 如果上一条是用户消息，直到收到<|round_start|>再开启token的接收
          if (this.messages[this.messages.length - 1].isUser) {
            if (data.token === '<|round_start|>') {
              this.messages[this.messages.length - 1].end = true;
              return;
            }
          }
          // 如果没有消息或上一条消息有结束标识，则创建一条新消息
          if (
            this.messages.length === 0 ||
            this.messages[this.messages.length - 1].end
          ) {
            this.addMessage({
              content: data.token,
              isUser: false,
            })
          } else {
            // 把这条token连接在message最后
            this.messages[this.messages.length - 1].content += data.token
          }
        }
      })

      // 连接断开
      this.socket.on('disconnect', () => {
        console.log('WebSocket 连接断开')
        this.isConnected = false
        this.modelId = null
      })

      // 错误处理
      this.socket.on('error', (error) => {
        console.error('WebSocket错误:', error)
        this.addMessage({
          content: error.message || '连接出现问题，请稍后重试',
          isUser: false,
          isError: true,
          end: true,
        })
        this.setLoading(false)
      })

      // 连接错误
      this.socket.on('connect_error', (error) => {
        console.error('连接错误:', error)
        this.isConnected = false
        if (!this.messages[this.messages.length - 1].isError) {
          this.addMessage({
            content: '无法连接到后端服务，请检查服务是否启动',
            isUser: false,
            isError: true,
            end: true,
          })
        }
      })
    },

    disconnectSocket() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
        this.isConnected = false
        this.modelId = null
      }
    },

    // 消息管理
    addMessage(message) {
      const newMessage = {
        id: uuidv4(),
        content: message.content,
        isUser: message.isUser,
        timestamp: new Date(),
        isError: message.isError || false,
        end: message.end || false,
      }

      this.messages.push(newMessage)
      // 注释掉历史记录相关功能
      // this.updateConversationTitle()
    },

    setLoading(loading) {
      this.isLoading = loading
    },

    // 注释掉所有历史记录管理功能
    // async loadConversations() {
    //   try {
    //     const thirtyDaysAgo = dayjs().subtract(30, 'day').toISOString()
    //     const response = await fetch(`/api/conversations?since=${thirtyDaysAgo}`)
    //     const data = await response.json()
    //     this.conversations = data.conversations || []
    //   } catch (error) {
    //     console.error('加载对话历史失败:', error)
    //   }
    // },

    // async createNewConversation() {
    //   const conversation = {
    //     id: uuidv4(),
    //     title: '新对话',
    //     createdAt: new Date().toISOString(),
    //     updatedAt: new Date().toISOString(),
    //     messageCount: 0,
    //   }

    //   this.currentConversation = conversation
    //   this.messages = []
    //   this.conversations.unshift(conversation)
    // },

    // async loadConversation(conversationId) {
    //   try {
    //     const response = await fetch(`/api/conversations/${conversationId}/messages`)
    //     const data = await response.json()

    //     this.currentConversation = this.conversations.find((c) => c.id === conversationId)
    //     this.messages = data.messages || []
    //   } catch (error) {
    //     console.error('加载对话失败:', error)
    //   }
    // },

    // async deleteConversation(conversationId) {
    //   try {
    //     await fetch(`/api/conversations/${conversationId}`, {
    //       method: 'DELETE',
    //     })

    //     this.conversations = this.conversations.filter((c) => c.id !== conversationId)

    //     if (this.currentConversation?.id === conversationId) {
    //       this.createNewConversation()
    //     }
    //   } catch (error) {
    //     console.error('删除对话失败:', error)
    //   }
    // },

    // updateConversationTitle() {
    //   if (this.currentConversation && this.messages.length > 0) {
    //     const firstUserMessage = this.messages.find((m) => m.isUser)
    //     if (firstUserMessage && this.currentConversation.title === '新对话') {
    //       this.currentConversation.title =
    //         firstUserMessage.content.substring(0, 30) +
    //         (firstUserMessage.content.length > 30 ? '...' : '')
    //       this.currentConversation.updatedAt = new Date().toISOString()
    //     }
    //   }
    // },

    // 创建简单对话（不保存历史）
    createNewConversation() {
      this.currentConversation = {
        id: uuidv4(),
        title: 'AI对话',
        createdAt: new Date().toISOString(),
      }
      this.messages = []
    },

    // 统一的发送消息方法
    async sendMessage(content, files = []) {
      if (!this.currentConversation) {
        this.createNewConversation()
      }

      // 添加用户消息
      let displayContent = content

      this.addMessage({
        content: displayContent,
        isUser: true,
      })

      this.setLoading(true)

      if (this.socket && this.isConnected) {
        try {
          // 统一使用 send_message 事件
          this.socket.emit('send_message', {
            message: content,
            has_video_stream: this.isVideoStreaming,
            video_stream_type: this.videoStreamType,
            files: files, // 如果后端需要的话
          })
        } catch (error) {
          console.error('发送消息失败:', error)
          this.addMessage({
            content: '发送消息失败，请重试',
            isUser: false,
            isError: true,
            end: true,
          })
          this.setLoading(false)
        }
      } else {
        this.addMessage({
          content: '未连接到服务器，请检查连接状态',
          isUser: false,
          isError: true,
          end: true,
        })
        this.setLoading(false)
      }
    },

    // 开始视频流
    startVideoStream(streamType, streamData) {
      // 确保有当前对话
      if (!this.currentConversation) {
        this.createNewConversation()
      }

      this.isVideoStreaming = true
      this.currentVideoStream = streamData
      this.videoStreamType = streamType

      // 添加视频流开始消息
      this.addMessage({
        content: `开始${streamType === 'camera' ? '摄像头' : '屏幕录制'}视频流传输`,
        isUser: false,
        end: true,
      })
    },

    // 停止视频流
    stopVideoStream(streamStats) {
      if (!this.isVideoStreaming || !this.currentConversation) return

      // 添加视频流结束消息
      this.addMessage({
        content: `视频流传输已结束\n持续时间: ${streamStats.duration}\n传输量: ${streamStats.dataTransferred}`,
        isUser: false,
        end: true,
      })

      this.isVideoStreaming = false
      this.currentVideoStream = null
      this.videoStreamType = null
    },

    sendVideoFrame(frameData) {
      console.log('发送视频帧:', frameData)
      if (!this.socket || !this.isVideoStreaming || !this.isConnected) return

      try {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64data = reader.result
          this.socket.emit('send_image', {
            image_data: base64data,
            is_video_frame: true,
            frame_timestamp: Date.now(),
          })
        }
        reader.readAsDataURL(frameData)
      } catch (error) {
        console.error('发送视频帧失败:', error)
      }
    },

    // 清空当前对话
    clearCurrentConversation() {
      this.messages = []
      this.currentConversation = null
      this.isLoading = false
    },

    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible
    },
  },
})
