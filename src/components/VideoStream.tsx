import React, { useRef, useState, useEffect, useContext, useCallback } from 'react'
import { Camera, Monitor, Square, Settings, Video } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ChatContext, VideoStreamType } from '@/utils'

interface VideoStreamProps {
    className?: string
}

const VideoStream: React.FC<VideoStreamProps> = ({ className }) => {
    const { socketRef, isVideoStreaming, setIsVideoStreaming, addMessage } = useContext(ChatContext)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const currentStreamRef = useRef<MediaStream | null>(null)
    const durationTimerRef = useRef<NodeJS.Timeout | null>(null)
    const rateTimerRef = useRef<NodeJS.Timeout | null>(null)
    const captureTimerRef = useRef<NodeJS.Timeout | null>(null)

    const [videoQuality, setVideoQuality] = useState<'480p' | '720p' | '1080p'>('480p')
    const [frameRate, setFrameRate] = useState<0.5 | 1>(0.5)
    const [startTime, setStartTime] = useState<string>('--')
    const [duration, setDuration] = useState<number>(0)
    const [dataTransferred, setDataTransferred] = useState<string>('0 MB')
    const [transmissionRate, setTransmissionRate] = useState<string>('0 KB/s')
    const [resolution, setResolution] = useState<string>('--')
    const [currentFrameRate, setCurrentFrameRate] = useState<string>('--')
    const [lastDataSize, setLastDataSize] = useState<number>(0)

    const qualityConfig = {
        '480p': { width: 854, height: 480 },
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
    }

    const formatDuration = useCallback((seconds: number): string => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }, [])

    const startTimers = useCallback(() => {
        const startTimeStamp = Date.now()

        durationTimerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeStamp) / 1000)
            setDuration(elapsed)
        }, 1000)

        rateTimerRef.current = setInterval(() => {
            const currentSizeStr = dataTransferred.replace(' MB', '')
            const currentSize = parseFloat(currentSizeStr) * 1024 * 1024
            const rate = (currentSize - lastDataSize) / 1024
            setTransmissionRate(`${rate.toFixed(1)} KB/s`)
            setLastDataSize(currentSize)
        }, 1000)
    }, [dataTransferred, lastDataSize])

    const stopTimers = useCallback(() => {
        if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current)
            durationTimerRef.current = null
        }
        if (rateTimerRef.current) {
            clearInterval(rateTimerRef.current)
            rateTimerRef.current = null
        }
        if (captureTimerRef.current) {
            clearTimeout(captureTimerRef.current)
            captureTimerRef.current = null
        }
    }, [])

    const startDataTransmission = () => {
        if (!socketRef.current) {
            console.error('WebSocket 未连接')
            return
        }

        const video = videoRef.current
        if (!video) return

        // 创建canvas（只创建一次）
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas')
            ctxRef.current = canvasRef.current.getContext('2d')
        }

        const canvas = canvasRef.current
        const ctx = ctxRef.current
        if (!canvas || !ctx) return

        let dataCount = 0
        let isCapturing = false

        const captureFrame = () => {
            if (!isVideoStreaming || !video.videoWidth || !video.videoHeight || isCapturing) return

            isCapturing = true

            // 只在视频尺寸改变时更新canvas尺寸
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
            }

            try {
                ctx.drawImage(video, 0, 0)

                canvas.toBlob(
                    (blob) => {
                        isCapturing = false
                        if (blob && socketRef.current && isVideoStreaming) {
                            // 发送视频帧到后端
                            socketRef.current.emit('video_frame', {
                                frame: blob,
                                timestamp: Date.now(),
                                frameRate: frameRate,
                                quality: videoQuality
                            })

                            dataCount += blob.size
                            setDataTransferred(`${(dataCount / 1024 / 1024).toFixed(2)} MB`)
                        }
                    },
                    'image/jpeg',
                    0.8
                )
            } catch (error) {
                console.error('帧捕获失败:', error)
                isCapturing = false
            }

            // 使用setTimeout而不是递归调用，避免调用栈问题
            if (isVideoStreaming) {
                captureTimerRef.current = setTimeout(captureFrame, 1000 / frameRate)
            }
        }

        // 等待视频加载完成后开始捕获
        const startCapture = () => {
            if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                captureFrame()
            } else {
                video.addEventListener('loadeddata', captureFrame, { once: true })
            }
        }

        startCapture()
    }

    // 开始视频流
    const startVideoStream = (streamType: VideoStreamType) => {
        // 添加视频流开始消息
        addMessage({
            content: `开始${streamType === VideoStreamType.Camera ? '摄像头' : '屏幕录制'}视频流传输`,
            isUser: false,
            end: true,
        })
    }

    const setupStream = (stream: MediaStream, type: VideoStreamType) => {
        currentStreamRef.current = stream
        if (videoRef.current) {
            videoRef.current.srcObject = stream
        }

        // 记录开始时间
        const now = new Date()
        setStartTime(now.toLocaleTimeString())
        setDuration(0)
        setLastDataSize(0)

        // 更新分辨率信息
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
            const settings = videoTrack.getSettings()
            setResolution(`${settings.width}x${settings.height}`)
            setCurrentFrameRate((settings.frameRate || frameRate).toString())
        }

        startVideoStream(type)

        // 设置视频流状态
        setIsVideoStreaming(true)

        // 启动定时器和数据传输
        startTimers()
        startDataTransmission()

        // 监听流结束
        stream.getVideoTracks()[0].onended = () => {
            stopStream()
        }
    }

    const startCameraStream = async () => {
        try {
            const quality = qualityConfig[videoQuality]
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: quality.width,
                    height: quality.height,
                    frameRate: frameRate,
                },
                audio: true,
            })

            setupStream(stream, VideoStreamType.Camera)
        } catch (error) {
            console.error('获取摄像头失败:', error)
            alert('无法访问摄像头')
        }
    }

    const startScreenStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: frameRate,
                },
                audio: true,
            })

            setupStream(stream, VideoStreamType.Screen)
        } catch (error) {
            console.error('获取屏幕录制失败:', error)
            alert('无法开始屏幕录制')
        }
    }

    const stopStream = () => {
        if (currentStreamRef.current) {
            currentStreamRef.current.getTracks().forEach((track) => track.stop())
            currentStreamRef.current = null
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null
        }

        // 清理canvas资源
        if (canvasRef.current) {
            canvasRef.current = null
            ctxRef.current = null
        }

        stopTimers()
        setIsVideoStreaming(false)

        // 重置状态
        setResolution('--')
        setCurrentFrameRate('--')
        setStartTime('--')
        setDuration(0)
        setDataTransferred('0 MB')
        setTransmissionRate('0 KB/s')
        setLastDataSize(0)

        // 通知后端停止视频流
        if (socketRef.current) {
            socketRef.current.emit('stop_video_stream', {
                duration: formatDuration(duration),
                dataTransferred: dataTransferred,
                transmissionRate: transmissionRate,
            })
        }
    }

    // 清理效果
    useEffect(() => {
        return () => {
            if (isVideoStreaming) {
                stopStream()
            }
        }
    }, [])

    return (
        <div className={`bg-background border rounded-lg overflow-hidden ${className}`}>
            <div className="flex h-96 gap-4 p-4">
                {/* 左侧：视频预览区 */}
                <div className="flex-1 relative">
                    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                        />

                        {/* 视频覆盖层 */}
                        {!isVideoStreaming && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                                <Video className="h-12 w-12 mb-3" />
                                <p className="text-sm">选择视频源开始预览</p>
                            </div>
                        )}

                        {/* 录制状态指示器 */}
                        {isVideoStreaming && (
                            <div className="absolute top-3 left-3 flex items-center bg-red-600 text-white px-3 py-1 rounded text-xs font-medium">
                                <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                                正在传输
                            </div>
                        )}

                        {/* 视频底部信息条 */}
                        {isVideoStreaming && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm text-white p-2">
                                <div className="flex justify-between text-xs">
                                    <div className="flex flex-col items-center min-w-0">
                                        <span className="text-gray-300 text-[10px]">开始时间</span>
                                        <span className="font-medium">{startTime}</span>
                                    </div>
                                    <div className="flex flex-col items-center min-w-0">
                                        <span className="text-gray-300 text-[10px]">持续时间</span>
                                        <span className="font-medium">{formatDuration(duration)}</span>
                                    </div>
                                    <div className="flex flex-col items-center min-w-0">
                                        <span className="text-gray-300 text-[10px]">传输量</span>
                                        <span className="font-medium">{dataTransferred}</span>
                                    </div>
                                    <div className="flex flex-col items-center min-w-0">
                                        <span className="text-gray-300 text-[10px]">速率</span>
                                        <span className="font-medium">{transmissionRate}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧：控制面板 */}
                <div className="w-72 flex flex-col gap-4">
                    {/* 流状态信息 */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <Monitor className="h-4 w-4" />
                                流状态
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">状态:</span>
                                <Badge variant={isVideoStreaming ? "default" : "secondary"}>
                                    {isVideoStreaming ? '传输中' : '未连接'}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">分辨率:</span>
                                <span>{resolution}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">帧率:</span>
                                <span>{currentFrameRate} fps</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 流设置控制 */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <Settings className="h-4 w-4" />
                                流设置
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 控制按钮 */}
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    onClick={startCameraStream}
                                    disabled={isVideoStreaming}
                                    className="flex items-center gap-2"
                                >
                                    <Camera className="h-4 w-4" />
                                    摄像头
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={startScreenStream}
                                    disabled={isVideoStreaming}
                                    className="flex items-center gap-2"
                                >
                                    <Monitor className="h-4 w-4" />
                                    录屏
                                </Button>
                            </div>

                            <Button
                                variant="outline"
                                onClick={stopStream}
                                disabled={!isVideoStreaming}
                                className="w-full flex items-center gap-2 border-red-200 hover:bg-red-50 hover:text-red-600"
                            >
                                <Square className="h-4 w-4" />
                                停止传输
                            </Button>

                            <Separator />

                            {/* 质量设置 */}
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">视频质量:</label>
                                    <Select
                                        value={videoQuality}
                                        onValueChange={(value: '480p' | '720p' | '1080p') => setVideoQuality(value)}
                                        disabled={isVideoStreaming}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="480p">低 (480p)</SelectItem>
                                            <SelectItem value="720p">中 (720p)</SelectItem>
                                            <SelectItem value="1080p">高 (1080p)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">帧率:</label>
                                    <Select
                                        value={frameRate.toString()}
                                        onValueChange={(value) => setFrameRate(Number(value) as 0.5 | 1)}
                                        disabled={isVideoStreaming}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0.5">0.5 fps</SelectItem>
                                            <SelectItem value="1">1 fps</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default VideoStream 