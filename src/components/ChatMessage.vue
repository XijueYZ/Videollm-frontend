<template>
  <div class="message-wrapper" :class="{ 'user-message': isUser }">
    <div class="message-container">
      <el-avatar v-if="isUser" icon="User" :size="40" />
      <el-avatar v-else icon="Service" :size="40" />

      <div class="message-content">
        <div class="message-header">
          <span class="message-author">{{ isUser ? '您' : 'AI助手' }}</span>
          <span class="message-time">{{ formatTime(timestamp) }}</span>
        </div>

        <el-card
          :class="{ 'error-message': isError, 'user-card': isUser }"
          class="message-card"
          shadow="never"
          :body-style="{ padding: '12px' }"
        >
          <div class="message-text" v-html="formattedContent"></div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script>
import dayjs from 'dayjs'

export default {
  name: 'ChatMessage',

  props: {
    content: {
      type: String,
      required: true,
    },
    isUser: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      default: () => new Date(),
    },
    isError: {
      type: Boolean,
      default: false,
    },
  },

  computed: {
    formattedContent() {
      let content = this.content

      // 代码块
      content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
        return `<pre class="code-block"><code>${this.escapeHtml(code.trim())}</code></pre>`
      })

      // 行内代码
      content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

      // 粗体和斜体
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      content = content.replace(/\*(.*?)\*/g, '<em>$1</em>')

      // 换行
      content = content.replace(/\n/g, '<br>')

      return content
    },

    avatarUrl() {
      return this.isUser
        ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'
        : 'https://api.dicebear.com/7.x/bottts/svg?seed=ai'
    },
  },

  methods: {
    formatTime(date) {
      return dayjs(date).format('HH:mm')
    },

    escapeHtml(text) {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    },
  },
}
</script>

<style scoped>
.message-wrapper {
  margin-bottom: 20px;
}

.user-message {
  display: flex;
  justify-content: flex-end;
}

.user-message .message-container {
  flex-direction: row-reverse;
}

.user-message .message-content {
  margin-right: 12px;
  text-align: right;
}

.message-container {
  display: flex;
  gap: 12px;
  max-width: 90%;
  align-items: flex-start;
}

.message-avatar {
  flex-shrink: 0;
  margin-top: 8px;
}

.message-content {
  flex: 1;
  margin-left: 12px;
}

.user-message .message-content {
  margin-left: 0;
  margin-right: 12px;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.user-message .message-header {
  justify-content: flex-end;
}

.message-author {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.message-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.message-card {
  border-radius: 12px;
}

.user-card {
  background: var(--el-color-primary);
  color: white;
}

.error-message {
  background: var(--el-color-error-light-9);
  border-color: var(--el-color-error-light-5);
  color: var(--el-color-error);
}

.message-text {
  line-height: 1.6;
  word-wrap: break-word;
  max-width: 80vw;
}

.message-text :deep(.inline-code) {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 85%;
}

.user-card .message-text :deep(.inline-code) {
  background: rgba(255, 255, 255, 0.2);
}

.message-text :deep(.code-block) {
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 12px;
  margin: 8px 0;
  overflow-x: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}
</style>
