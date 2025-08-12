<template>
  <div class="video-stream-container">
    <div class="stream-content">
      <!-- 左侧：视频预览区 -->
      <div class="video-preview-section">
        <div class="video-preview-container">
          <video ref="videoElement" autoplay muted playsinline class="video-preview"></video>

          <!-- 视频覆盖层信息 -->
          <div v-if="!isStreaming" class="video-overlay">
            <el-icon size="48"><VideoCamera /></el-icon>
            <p>选择视频源开始预览</p>
          </div>

          <!-- 录制状态指示器 -->
          <div v-if="isStreaming" class="recording-indicator">
            <div class="recording-dot"></div>
            <span>正在传输</span>
          </div>

          <!-- 视频底部信息条 -->
          <div v-if="isStreaming" class="video-info-bar">
            <div class="info-item">
              <span class="info-label">开始时间:</span>
              <span>{{ startTime }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">持续时间:</span>
              <span>{{ formatDuration(streamDuration) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">传输量:</span>
              <span>{{ dataTransferred }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">速率:</span>
              <span>{{ transmissionRate }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：控制面板 -->
      <div class="control-panel-section">
        <!-- 流状态信息 -->
        <el-card class="status-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><Monitor /></el-icon>
              <span>流状态</span>
            </div>
          </template>

          <div class="status-info">
            <div class="status-item">
              <span class="label">状态:</span>
              <el-tag :type="streamStatus.type" size="small">{{ streamStatus.text }}</el-tag>
            </div>
            <div class="status-item">
              <span class="label">分辨率:</span>
              <span>{{ resolution }}</span>
            </div>
            <div class="status-item">
              <span class="label">帧率:</span>
              <span>{{ frameRate }} fps</span>
            </div>
          </div>
        </el-card>

        <!-- 流设置控制 -->
        <el-card class="control-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><Setting /></el-icon>
              <span>流设置</span>
            </div>
          </template>

          <div class="control-section">
            <div class="button-group">
              <el-button
                @click="startCameraStream"
                :disabled="isStreaming"
                type="primary"
                icon="Camera"
                size="large"
              >
                摄像头
              </el-button>

              <el-button
                @click="startScreenStream"
                :disabled="isStreaming"
                type="success"
                icon="Monitor"
                size="large"
              >
                录屏
              </el-button>
            </div>

            <div class="button-group">
              <el-button
                @click="stopStream"
                :disabled="!isStreaming"
                type="danger"
                icon="VideoPause"
                size="large"
              >
                停止传输
              </el-button>
            </div>
          </div>

          <!-- 质量设置 -->
          <el-divider />

          <div class="quality-settings">
            <div class="setting-item">
              <span class="setting-label" style="margin-right: 10px">视频质量: </span>
              <el-select
                v-model="videoQuality"
                @change="updateVideoQuality"
                :disabled="isStreaming"
                size="small"
                style="flex: 1"
              >
                <el-option label="低 (480p)" value="480p" />
                <el-option label="中 (720p)" value="720p" />
                <el-option label="高 (1080p)" value="1080p" />
              </el-select>
            </div>

            <div class="setting-item">
              <span class="setting-label" style="margin-right: 10px">帧率: </span>
              <el-select
                v-model="selectedFrameRate"
                @change="updateFrameRate"
                :disabled="isStreaming"
                size="small"
                style="flex: 1"
              >
                <el-option label="1 fps" :value="1" />
                <el-option label="2 fps" :value="2" />
                <el-option label="4 fps" :value="4" />
              </el-select>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script lang="jsx">
import { ref, onUnmounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '../stores'

export default {
  name: 'VideoStream',
  setup() {
    const store = useChatStore()

    const videoElement = ref(null)
    const currentStream = ref(null)
    const videoQuality = ref('720p')
    const selectedFrameRate = ref(1)

    // 时间统计数据
    const startTimeStamp = ref(null)
    const streamDuration = ref(0)
    const startTime = ref('--')
    const dataTransferred = ref('0 MB')
    const transmissionRate = ref('0 KB/s')
    const resolution = ref('--')
    const frameRate = ref('--')

    // 从store获取视频流状态
    const isStreaming = computed(() => store.isVideoStreaming)

    // 流状态计算属性
    const streamStatus = computed(() => {
      if (isStreaming.value) {
        return { type: 'success', text: '传输中' }
      }
      return { type: 'info', text: '未连接' }
    })

    // 定时器
    let durationTimer = null
    let rateTimer = null
    let lastDataSize = 0

    // 质量配置映射
    const qualityConfig = {
      '480p': { width: 854, height: 480 },
      '720p': { width: 1280, height: 720 },
      '1080p': { width: 1920, height: 1080 },
    }

    // 格式化持续时间
    const formatDuration = (seconds) => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60

      if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      }
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // 获取摄像头流
    const startCameraStream = async () => {
      try {
        const quality = qualityConfig[videoQuality.value]
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: quality.width,
            height: quality.height,
            frameRate: selectedFrameRate.value,
          },
          audio: true,
        })

        setupStream(stream, 'camera')
        ElMessage.success('摄像头流已启动')
      } catch (error) {
        console.error('获取摄像头失败:', error)
        ElMessage.error('无法访问摄像头')
      }
    }

    // 获取屏幕录制流
    const startScreenStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: selectedFrameRate.value,
          },
          audio: true,
        })

        setupStream(stream, 'screen')
        ElMessage.success('屏幕录制已启动')
      } catch (error) {
        console.error('获取屏幕录制失败:', error)
        ElMessage.error('无法开始屏幕录制')
      }
    }

    // 设置流
    const setupStream = (stream, type) => {
      currentStream.value = stream
      videoElement.value.srcObject = stream

      // 记录开始时间
      const now = new Date()
      startTimeStamp.value = now
      startTime.value = now.toLocaleTimeString()
      streamDuration.value = 0
      lastDataSize = 0

      // 更新分辨率信息
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        const settings = videoTrack.getSettings()
        resolution.value = `${settings.width}x${settings.height}`
        frameRate.value = settings.frameRate || selectedFrameRate.value
      }

      // 通知store开始视频流
      store.startVideoStream(type, {
        quality: videoQuality.value,
        frameRate: selectedFrameRate.value,
        resolution: resolution.value,
      })

      // 启动定时器
      startTimers()

      // 开始传输数据
      startDataTransmission(stream)

      // 监听流结束
      stream.getVideoTracks()[0].onended = () => {
        stopStream()
      }
    }

    // 开始数据传输
    const startDataTransmission = () => {
      if (!store.socket) {
        ElMessage.error('WebSocket 未连接')
        return
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const video = videoElement.value

      let dataCount = 0

      const captureFrame = () => {
        if (!isStreaming.value) return

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)

        canvas.toBlob(
          (blob) => {
            if (blob && store.socket) {
              // 使用store的方法发送视频帧
              store.sendVideoFrame(blob)
              dataCount += blob.size
              dataTransferred.value = `${(dataCount / 1024 / 1024).toFixed(2)} MB`
            }
          },
          'image/jpeg',
          0.8,
        )

        setTimeout(captureFrame, 1000 / selectedFrameRate.value)
      }

      // 等待视频加载后开始捕获
      video.onloadedmetadata = () => {
        setTimeout(captureFrame, 100)
      }
    }

    // 停止流
    const stopStream = () => {
      if (currentStream.value) {
        currentStream.value.getTracks().forEach((track) => track.stop())
        currentStream.value = null
      }

      if (videoElement.value) {
        videoElement.value.srcObject = null
      }

      stopTimers()

      // 通知store停止视频流
      store.stopVideoStream({
        duration: formatDuration(streamDuration.value),
        dataTransferred: dataTransferred.value,
        transmissionRate: transmissionRate.value,
        totalFrames: Math.floor(streamDuration.value * selectedFrameRate.value),
      })

      // 重置状态
      resolution.value = '--'
      frameRate.value = '--'
      startTime.value = '--'
      streamDuration.value = 0
      dataTransferred.value = '0 MB'
      transmissionRate.value = '0 KB/s'

      ElMessage.info('视频流已停止')
    }

    // 启动定时器
    const startTimers = () => {
      durationTimer = setInterval(() => {
        if (startTimeStamp.value) {
          streamDuration.value = Math.floor((Date.now() - startTimeStamp.value) / 1000)
        }
      }, 1000)

      rateTimer = setInterval(() => {
        const currentSize = parseFloat(dataTransferred.value.replace(' MB', '')) * 1024 * 1024
        const rate = (currentSize - lastDataSize) / 1024
        transmissionRate.value = `${rate.toFixed(1)} KB/s`
        lastDataSize = currentSize
      }, 1000)
    }

    // 停止定时器
    const stopTimers = () => {
      if (durationTimer) {
        clearInterval(durationTimer)
        durationTimer = null
      }
      if (rateTimer) {
        clearInterval(rateTimer)
        rateTimer = null
      }
    }

    // 更新设置
    const updateVideoQuality = () => {
      ElMessage.info('质量设置将在下次启动时生效')
    }

    const updateFrameRate = () => {
      ElMessage.info('帧率设置将在下次启动时生效')
    }

    onUnmounted(() => {
      if (isStreaming.value) {
        stopStream()
      }
    })

    return {
      videoElement,
      isStreaming,
      streamStatus,
      streamDuration,
      startTime,
      dataTransferred,
      transmissionRate,
      resolution,
      frameRate,
      videoQuality,
      selectedFrameRate,
      formatDuration,
      startCameraStream,
      startScreenStream,
      stopStream,
      updateVideoQuality,
      updateFrameRate,
    }
  },
}
</script>

<style scoped>
.video-stream-container {
  height: 40vh;
  background: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
}

.stream-content {
  display: flex;
  height: calc(100% - 32px);
  gap: 16px;
  padding: 16px;
}

/* 左侧视频预览区 */
.video-preview-section {
  flex: 1;
  min-width: 0;
}

.video-preview-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
}

.video-overlay p {
  margin: 12px 0 0 0;
  font-size: 14px;
}

.recording-indicator {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  background: rgba(255, 0, 0, 0.9);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.recording-dot {
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  margin-right: 6px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 右侧控制面板 */
.control-panel-section {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.status-card,
.control-card {
  flex-shrink: 0;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.label {
  color: #666;
  font-weight: 500;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.button-group {
  display: flex;
  gap: 8px;
}

.button-group .el-button {
  flex: 1;
}

.quality-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
}

.setting-label {
  color: #666;
  font-weight: 500;
}

:deep(.el-card__body) {
  padding: 16px;
}

:deep(.el-card__header) {
  padding: 12px 16px;
  background: #f8f9fa;
}

/* 视频底部信息条 */
.video-info-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  backdrop-filter: blur(4px);
}

.info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.info-label {
  font-size: 10px;
  color: #ccc;
  margin-bottom: 2px;
}

.info-item span:last-child {
  font-weight: 500;
  font-size: 11px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .video-info-bar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .info-item {
    min-width: 45px;
    font-size: 10px;
  }
}
</style>
