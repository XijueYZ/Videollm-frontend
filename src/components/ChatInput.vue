<template>
  <div class="chat-input-container">
    <div class="input-wrapper">
      <el-input
        ref="messageInput"
        v-model="inputText"
        type="textarea"
        :rows="1"
        :autosize="{ minRows: 1, maxRows: 4 }"
        placeholder="输入您的问题..."
        :disabled="isLoading"
        @keydown="handleKeydown"
        class="message-input"
        size="large"
      />

      <!-- 文件上传按钮 -->
      <!-- <el-dropdown trigger="click" class="upload-dropdown">
        <el-button
          text
          title="上传文件"
          class="upload-btn"
          circle
          size="large"
        >
          <el-icon><Paperclip /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="triggerFileUpload('image')">
              <el-icon><Picture /></el-icon>
              上传图片
            </el-dropdown-item>
            <el-dropdown-item @click="triggerFileUpload('video')">
              <el-icon><VideoCamera /></el-icon>
              上传视频
            </el-dropdown-item>
            <el-dropdown-item @click="triggerFileUpload('document')">
              <el-icon><Document /></el-icon>
              上传文档
            </el-dropdown-item>
            <el-dropdown-item @click="triggerFileUpload('all')">
              <el-icon><Folder /></el-icon>
              所有文件
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown> -->

      <!-- 发送按钮 -->
      <el-button
        @click="sendMessage"
        :disabled="!canSend"
        :loading="isLoading"
        type="primary"
        circle
        size="large"
        title="发送消息"
        class="send-btn"
      >
        <el-icon v-if="!isLoading"><Top /></el-icon>
      </el-button>
    </div>

    <!-- 文件预览 -->
    <div v-if="selectedFiles.length > 0" class="files-preview">
      <div v-for="(file, index) in selectedFiles" :key="index" class="file-preview-item">
        <!-- 图片预览 -->
        <div v-if="isImageFile(file)" class="image-preview" @click="previewImage(file, index)">
          <img :src="getFilePreview(file)" alt="图片预览" />
          <div class="preview-overlay">
            <el-icon size="24"><ZoomIn /></el-icon>
          </div>
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
          </div>
          <el-button
            @click.stop="removeFile(index)"
            icon="Close"
            circle
            size="small"
            type="danger"
            class="remove-btn"
          />
        </div>

        <!-- 视频预览 -->
        <div v-else-if="isVideoFile(file)" class="video-preview" @click="previewVideo(file, index)">
          <div class="video-thumbnail">
            <video :src="getFilePreview(file)" preload="metadata" muted></video>
            <div class="video-overlay">
              <el-icon size="32"><VideoPlay /></el-icon>
              <span class="play-text">点击预览</span>
            </div>
          </div>
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <span class="file-duration" v-if="file.duration">{{
              formatDuration(file.duration)
            }}</span>
          </div>
          <el-button
            @click.stop="removeFile(index)"
            icon="Close"
            circle
            size="small"
            type="danger"
            class="remove-btn"
          />
        </div>

        <!-- 其他文件预览 -->
        <div v-else class="document-preview">
          <div class="document-icon">
            <el-icon size="24">
              <Document v-if="isDocumentFile(file)" />
              <Files v-else />
            </el-icon>
          </div>
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
          </div>
          <el-button
            @click="removeFile(index)"
            icon="Close"
            circle
            size="small"
            type="danger"
            class="remove-btn"
          />
        </div>
      </div>
    </div>

    <!-- 视频预览模态框 -->
    <el-dialog
      v-model="showVideoPreview"
      title="视频预览"
      width="80%"
      :before-close="closeVideoPreview"
      class="video-preview-dialog"
    >
      <div class="video-preview-content">
        <video
          v-if="currentPreviewFile"
          :src="getFilePreview(currentPreviewFile)"
          controls
          autoplay
          class="preview-video"
          @loadedmetadata="onVideoLoaded"
        >
          您的浏览器不支持视频播放
        </video>

        <div class="video-info" v-if="currentPreviewFile">
          <div class="info-row">
            <span class="label">文件名:</span>
            <span class="value">{{ currentPreviewFile.name }}</span>
          </div>
          <div class="info-row">
            <span class="label">文件大小:</span>
            <span class="value">{{ formatFileSize(currentPreviewFile.size) }}</span>
          </div>
          <div class="info-row" v-if="currentPreviewFile.duration">
            <span class="label">视频时长:</span>
            <span class="value">{{ formatDuration(currentPreviewFile.duration) }}</span>
          </div>
          <div class="info-row" v-if="videoMetadata.width">
            <span class="label">分辨率:</span>
            <span class="value">{{ videoMetadata.width }} × {{ videoMetadata.height }}</span>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 图片预览模态框 -->
    <el-dialog
      v-model="showImagePreview"
      title="图片预览"
      width="90%"
      :before-close="closeImagePreview"
      class="image-preview-dialog"
    >
      <div class="image-preview-content">
        <img
          v-if="currentPreviewFile"
          :src="getFilePreview(currentPreviewFile)"
          alt="图片预览"
          class="preview-image"
        />

        <div class="image-info" v-if="currentPreviewFile">
          <div class="info-row">
            <span class="label">文件名:</span>
            <span class="value">{{ currentPreviewFile.name }}</span>
          </div>
          <div class="info-row">
            <span class="label">文件大小:</span>
            <span class="value">{{ formatFileSize(currentPreviewFile.size) }}</span>
          </div>
          <div class="info-row">
            <span class="label">文件类型:</span>
            <span class="value">{{ currentPreviewFile.type }}</span>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 隐藏的文件输入 -->
    <input ref="fileInput" type="file" @change="handleFileSelect" multiple style="display: none" />
  </div>
</template>

<script>
import { ElMessage } from 'element-plus'

export default {
  name: 'ChatInput',

  props: {
    isLoading: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      inputText: '',
      selectedFiles: [],
      filePreviewUrls: new Map(),

      // 预览相关
      showVideoPreview: false,
      showImagePreview: false,
      currentPreviewFile: null,
      currentPreviewIndex: -1,
      videoMetadata: {
        width: 0,
        height: 0,
      },
    }
  },

  computed: {
    canSend() {
      return (this.inputText.trim() || this.selectedFiles.length > 0) && !this.isLoading
    },
  },

  methods: {
    sendMessage() {
      if (!this.canSend) return

      this.$emit('send-message', {
        content: this.inputText.trim(),
        files: this.selectedFiles,
      })

      this.inputText = ''
      this.clearFiles()
    },

    handleKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        this.sendMessage()
      }
    },

    // 预览功能
    previewVideo(file, index) {
      this.currentPreviewFile = file
      this.currentPreviewIndex = index
      this.showVideoPreview = true
      this.videoMetadata = { width: 0, height: 0 }
    },

    previewImage(file, index) {
      this.currentPreviewFile = file
      this.currentPreviewIndex = index
      this.showImagePreview = true
    },

    closeVideoPreview() {
      this.showVideoPreview = false
      this.currentPreviewFile = null
      this.currentPreviewIndex = -1
      this.videoMetadata = { width: 0, height: 0 }
    },

    closeImagePreview() {
      this.showImagePreview = false
      this.currentPreviewFile = null
      this.currentPreviewIndex = -1
    },

    onVideoLoaded(event) {
      const video = event.target
      this.videoMetadata = {
        width: video.videoWidth,
        height: video.videoHeight,
      }
    },

    triggerFileUpload(type) {
      const fileInput = this.$refs.fileInput

      switch (type) {
        case 'image':
          fileInput.accept = 'image/*'
          break
        case 'video':
          fileInput.accept = 'video/*'
          break
        case 'document':
          fileInput.accept = '.pdf,.doc,.docx,.txt,.md,.rtf'
          break
        case 'all':
        default:
          fileInput.accept = 'image/*,video/*,.pdf,.doc,.docx,.txt,.md,.rtf'
          break
      }

      fileInput.click()
    },

    async handleFileSelect(event) {
      const files = Array.from(event.target.files)

      for (const file of files) {
        const maxSize = this.getMaxFileSize(file)
        if (file.size > maxSize) {
          ElMessage.error(`文件 ${file.name} 超过${this.formatFileSize(maxSize)}限制`)
          continue
        }

        if (!this.isAllowedFileType(file)) {
          ElMessage.error(`不支持的文件类型: ${file.name}`)
          continue
        }

        if (this.isVideoFile(file)) {
          try {
            file.duration = await this.getVideoDuration(file)
          } catch (error) {
            console.warn('无法获取视频时长:', error)
          }
        }

        this.selectedFiles.push(file)

        if (this.isImageFile(file) || this.isVideoFile(file)) {
          const previewUrl = URL.createObjectURL(file)
          this.filePreviewUrls.set(file, previewUrl)
        }
      }

      if (files.length > 0) {
        ElMessage.success(`已选择 ${files.length} 个文件`)
      }

      event.target.value = ''
    },

    removeFile(index) {
      const file = this.selectedFiles[index]

      if (this.filePreviewUrls.has(file)) {
        URL.revokeObjectURL(this.filePreviewUrls.get(file))
        this.filePreviewUrls.delete(file)
      }

      this.selectedFiles.splice(index, 1)
    },

    clearFiles() {
      this.filePreviewUrls.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      this.filePreviewUrls.clear()
      this.selectedFiles = []
    },

    // 文件类型检查方法
    isImageFile(file) {
      return file.type.startsWith('image/')
    },

    isVideoFile(file) {
      return file.type.startsWith('video/')
    },

    isDocumentFile(file) {
      const docTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
      ]
      return docTypes.includes(file.type)
    },

    isAllowedFileType(file) {
      const allowedTypes = [
        'image/',
        'video/',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
      ]

      return allowedTypes.some((type) => file.type.startsWith(type))
    },

    getMaxFileSize(file) {
      if (this.isVideoFile(file)) {
        return 1000 * 1024 * 1024 // 1000MB
      } else if (this.isImageFile(file)) {
        return 10 * 1024 * 1024 // 10MB
      } else {
        return 10 * 1024 * 1024 // 10MB
      }
    },

    getFilePreview(file) {
      return this.filePreviewUrls.get(file) || ''
    },

    getVideoDuration(file) {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.preload = 'metadata'

        video.onloadedmetadata = () => {
          resolve(video.duration)
        }

        video.onerror = () => {
          reject(new Error('无法加载视频元数据'))
        }

        video.src = URL.createObjectURL(file)
      })
    },

    formatFileSize(bytes) {
      if (bytes === 0) return '0 B'

      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))

      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },

    formatDuration(seconds) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = Math.floor(seconds % 60)
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    },
  },

  beforeUnmount() {
    this.clearFiles()
  },

  mounted() {
    this.$refs.messageInput.focus()
  },
}
</script>

<style scoped>
.chat-input-container {
  background: white;
  border-top: 1px solid var(--el-border-color-light);
  padding: 16px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
}

.input-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  max-width: 1000px;
  margin: 0 auto;
}

.message-input {
  flex: 1;
}

.upload-btn {
  width: 40px !important;
  height: 40px !important;
  border: 1px solid var(--el-border-color-light) !important;
  background: white !important;
  color: var(--el-text-color-secondary) !important;
  transition: all 0.2s !important;
  flex-shrink: 0;
}

.upload-btn:hover {
  color: var(--el-color-primary) !important;
  border-color: var(--el-color-primary) !important;
  background: var(--el-color-primary-light-9) !important;
}

.send-btn {
  width: 40px !important;
  height: 40px !important;
  flex-shrink: 0;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.send-btn:not(.is-disabled) {
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

.send-btn:not(.is-disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
}

/* 文件预览样式 */
.files-preview {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
}

.file-preview-item {
  position: relative;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-fill-color-lighter);
  transition: all 0.2s;
  cursor: pointer;
}

.file-preview-item:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

/* 图片预览 */
.image-preview {
  position: relative;
}

.image-preview img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  color: white;
}

.image-preview:hover .preview-overlay {
  opacity: 1;
}

/* 视频预览 */
.video-preview {
  position: relative;
}

.video-thumbnail {
  position: relative;
  width: 100%;
  height: 120px;
  background: #000;
  overflow: hidden;
}

.video-thumbnail video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  transition: all 0.2s;
}

.video-preview:hover .video-overlay {
  background: rgba(0, 0, 0, 0.8);
  transform: translate(-50%, -50%) scale(1.05);
}

.play-text {
  font-size: 12px;
  margin-top: 4px;
  text-align: center;
}

/* 文档预览 */
.document-preview {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
  cursor: default;
}

.document-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

/* 文件信息 */
.file-info {
  padding: 12px;
  background: white;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.document-preview .file-info {
  padding: 0;
  background: transparent;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size,
.file-duration {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 删除按钮 */
.remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px !important;
  height: 24px !important;
  background: rgba(0, 0, 0, 0.6) !important;
  border: none !important;
  backdrop-filter: blur(4px);
  z-index: 10;
}

.document-preview .remove-btn {
  position: static;
  margin-left: auto;
  background: var(--el-color-danger-light-9) !important;
  backdrop-filter: none;
}

.remove-btn:hover {
  background: var(--el-color-danger) !important;
  transform: scale(1.1);
}

/* 预览模态框样式 */
.video-preview-dialog :deep(.el-dialog) {
  background: #000;
  border-radius: 12px;
}

.video-preview-dialog :deep(.el-dialog__header) {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border-bottom: 1px solid #333;
}

.video-preview-dialog :deep(.el-dialog__body) {
  padding: 0;
  background: #000;
}

.video-preview-content {
  display: flex;
  flex-direction: column;
}

.preview-video {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.video-info {
  padding: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
}

.image-preview-dialog :deep(.el-dialog__body) {
  padding: 0;
  text-align: center;
  background: #f5f5f5;
}

.image-preview-content {
  display: flex;
  flex-direction: column;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  margin: 0 auto;
}

.image-info {
  padding: 20px;
  background: white;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.image-info .info-row {
  border-bottom: 1px solid #f0f0f0;
  color: var(--el-text-color-primary);
}

.label {
  font-weight: 500;
  opacity: 0.8;
}

.value {
  font-weight: 400;
}

/* 下拉菜单样式 */
.upload-dropdown {
  height: 100%;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  transition: all 0.2s;
}

:deep(.el-dropdown-menu__item:hover) {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

/* 输入框样式 */
:deep(.el-textarea__inner) {
  border-radius: 20px !important;
  padding: 12px 16px !important;
  border: 1px solid var(--el-border-color-light) !important;
  resize: none !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
  transition: border-color 0.2s !important;
  background: var(--el-fill-color-lighter) !important;
}

:deep(.el-textarea__inner:focus) {
  border-color: var(--el-color-primary) !important;
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8) !important;
  background: white !important;
}

:deep(.el-textarea__inner:not(:placeholder-shown)) {
  background: white !important;
  border-color: var(--el-color-primary-light-7) !important;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chat-input-container {
    padding: 12px;
  }

  .input-wrapper {
    gap: 6px;
  }

  .upload-btn,
  .send-btn {
    width: 36px !important;
    height: 36px !important;
  }

  .files-preview {
    grid-template-columns: 1fr;
    margin-top: 12px;
  }

  :deep(.el-textarea__inner) {
    padding: 10px 14px !important;
    font-size: 16px !important;
  }

  .video-preview-dialog :deep(.el-dialog),
  .image-preview-dialog :deep(.el-dialog) {
    width: 95% !important;
    margin: 5vh auto !important;
  }
}
</style>
