<template>
  <div class="chat-layout">
    <!-- 注释掉侧边栏 -->
    <!-- <ConversationSidebar /> -->

    <!-- 主内容区 -->
    <div class="chat-main">
      <!-- 头部 -->
      <el-header class="chat-header" height="60px">
        <!-- 注释掉侧边栏切换按钮 -->
        <!-- <el-button
          @click="toggleSidebar"
          icon="Menu"
          circle
          text
          title="切换侧边栏"
        /> -->

        <div class="conversation-title">
          {{ currentConversation?.title || 'AI对话助手' }}
        </div>

        <div class="header-actions">
          <!-- 视频流按钮 -->
          <el-button
            @click="toggleVideoStream"
            :type="showVideoStream ? 'primary' : 'default'"
            icon="VideoCamera"
            circle
            title="视频流"
          />

          <!-- 连接状态和模型ID -->
          <div class="connection-status">
            <el-tooltip
              :content="isConnected ? `已连接 - 模型: ${modelId || 'N/A'}` : '连接已断开'"
              placement="bottom"
            >
              <el-icon :color="isConnected ? '#67c23a' : '#f56c6c'">
                <component :is="isConnected ? 'Connection' : 'WarningFilled'" />
              </el-icon>
            </el-tooltip>
          </div>

          <!-- 重连按钮 -->
          <el-button
            v-if="!isConnected"
            @click="reconnect"
            icon="Refresh"
            circle
            text
            title="重新连接"
          />
        </div>
      </el-header>

      <!-- 视频流面板 -->
      <div v-if="showVideoStream" class="video-stream-panel">
        <VideoStream :socket="socket" :is-connected="isConnected" />
      </div>

      <!-- 消息区域 -->
      <el-main class="messages-area" ref="messagesArea">
        <!-- 连接警告 -->
        <el-alert
          v-if="!isConnected"
          description="正在连接中"
          type="warning"
          :closable="false"
          class="connection-alert"
        />

        <!-- 欢迎消息 -->
        <div v-if="messages.length === 0" class="welcome-message">
          <div class="welcome-icon">🤖</div>
          <h2>您好！我是AI助手</h2>
          <p>已连接到后端模型服务</p>
          <div v-if="modelId" class="model-info">
            <el-tag type="success">当前模型: {{ modelId }}</el-tag>
          </div>
          <p>您可以：</p>
          <ul class="welcome-features">
            <li>💬 与我自由对话，询问各种问题</li>
            <li>📎 上传文档和图片，我来帮您分析</li>
            <li>🎥 开启视频流，进行实时交互</li>
            <li>💡 获取编程、学习、工作等方面的建议</li>
          </ul>
          <p class="welcome-tip">现在就开始对话吧！</p>
        </div>

        <!-- 消息列表 -->
        <div class="messages-container">
          <ChatMessage
            v-for="message in messages"
            :key="message.id"
            :content="message.content"
            :is-user="message.isUser"
            :timestamp="message.timestamp"
            :is-error="message.isError"
          />

          <!-- 加载指示器 -->
          <div v-if="isLoading" class="loading-message">
            <el-avatar src="https://api.dicebear.com/7.x/bottts/svg?seed=ai" :size="40" />
            <div class="loading-content">
              <div class="loading-text">
                <span class="loading-author">AI助手</span>
                <div class="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <span class="loading-status">正在思考中...</span>
            </div>
          </div>
        </div>
      </el-main>

      <!-- 输入区域 -->
      <el-footer class="input-area" height="auto">
        <ChatInput @send-message="handleSendMessage" :is-loading="isLoading" />
      </el-footer>
    </div>
  </div>
</template>

<script>
import { onMounted, onUnmounted, nextTick, watch, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores'
// 注释掉侧边栏组件
// import ConversationSidebar from '@/components/ConversationSidebar.vue'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import VideoStream from '@/components/VideoStream.vue'
import { Connection, WarningFilled, VideoCamera, Delete, Refresh } from '@element-plus/icons-vue'

export default {
  name: 'ChatView',
  components: {
    // ConversationSidebar, // 注释掉
    ChatMessage,
    ChatInput,
    VideoStream,
    Connection,
    WarningFilled,
    VideoCamera,
    Delete,
    Refresh,
  },

  setup() {
    const chatStore = useChatStore()
    const messagesArea = ref(null)
    const showVideoStream = ref(false)

    const {
      messages,
      isLoading,
      isConnected,
      socket,
      currentConversation,
      modelId,
      // sidebarVisible, // 注释掉
    } = storeToRefs(chatStore)

    // 初始化连接
    onMounted(() => {
      console.log('ChatView mounted - 初始化websocket')
      chatStore.initSocket()

      // 创建一个新对话
      if (!currentConversation.value) {
        chatStore.createNewConversation()
      }
    })

    // 组件卸载时清理 - 移到 setup() 顶层
    onUnmounted(() => {
      console.log('ChatView unmounted - 断开websocket连接')
      chatStore.disconnectSocket()
    })

    // 滚动到底部
    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesArea.value) {
          const container = messagesArea.value.$el
          container.scrollTop = container.scrollHeight
        }
      })
    }

    // 监听消息变化，自动滚动
    watch(messages, scrollToBottom, { deep: true })

    // 发送消息处理 - 简化
    const handleSendMessage = async ({ content, files = [] }) => {
      if (!content.trim() && files.length === 0) return

      try {
        await chatStore.sendMessage(content, files)
      } catch (error) {
        console.error('发送消息失败:', error)
        chatStore.addMessage({
          content: '发送消息失败，请重试',
          isUser: false,
          isError: true,
        })
      }
    }

    // 切换视频流
    const toggleVideoStream = () => {
      showVideoStream.value = !showVideoStream.value
    }

    // 重新连接
    const reconnect = () => {
      console.log('手动重新连接...')
      chatStore.disconnectSocket()
      setTimeout(() => {
        chatStore.initSocket()
      }, 1000)
    }

    // 注释掉侧边栏相关功能
    // const toggleSidebar = () => {
    //   chatStore.toggleSidebar()
    // }

    return {
      // 数据
      messages,
      isLoading,
      isConnected,
      socket,
      currentConversation,
      modelId,
      showVideoStream,
      messagesArea,
      // sidebarVisible, // 注释掉

      // 方法
      handleSendMessage,
      toggleVideoStream,
      reconnect,
      // toggleSidebar, // 注释掉
    }
  },
}
</script>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* 移除侧边栏相关样式 */
  /* transition: margin-left 0.3s ease; */
}

/* 注释掉侧边栏相关样式 */
/* .chat-main.sidebar-visible {
  margin-left: 300px;
} */

.chat-header {
  background: white;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.conversation-title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  flex: 1;
  text-align: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.connection-status {
  display: flex;
  align-items: center;
}

.model-info {
  margin: 10px 0;
}

.video-stream-panel {
  background: white;
  border-bottom: 1px solid #e4e7ed;
  padding: 20px;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f5f7fa;
}

.connection-alert {
  margin-bottom: 20px;
}

.welcome-message {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  margin: 0 auto;
}

.welcome-icon {
  font-size: 60px;
  margin-bottom: 20px;
}

.welcome-message h2 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.welcome-message p {
  color: #606266;
  margin-bottom: 20px;
}

.welcome-features {
  text-align: left;
  max-width: 400px;
  margin: 20px auto;
  color: #909399;
}

.welcome-features li {
  margin-bottom: 8px;
}

.welcome-tip {
  color: #409eff;
  font-weight: 500;
}

.messages-container {
  max-width: 90vw;
  margin: 0 auto;
}

.loading-message {
  display: flex;
  align-items: flex-start;
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.loading-content {
  margin-left: 12px;
  flex: 1;
}

.loading-text {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.loading-author {
  font-weight: 600;
  color: #2c3e50;
  margin-right: 10px;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background: #409eff;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) {
  animation-delay: 0s;
}
.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

.loading-status {
  font-size: 12px;
  color: #909399;
}

.input-area {
  background: white;
  border-top: 1px solid #e4e7ed;
  padding: 20px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chat-header {
    padding: 0 15px;
  }

  .conversation-title {
    font-size: 16px;
  }

  .messages-area {
    padding: 15px;
  }

  .welcome-message {
    padding: 40px 15px;
  }
}
</style>
