import React, { useRef, useState, useEffect, useContext, useCallback } from 'react'
import { Camera, Monitor, Square, Settings, Video, Upload } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ChatContext, qualityConfig, SidebarKey, VideoStreamType } from '@/utils'

interface VideoStreamProps {
    className?: string
}

const VideoStream: React.FC<VideoStreamProps> = ({ className }) => {
    const { socketRef, isVideoStreaming, setIsVideoStreaming, addMessage } = useContext(ChatContext)

    const isVideoStreamingRef = useRef(isVideoStreaming)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const currentStreamRef = useRef<MediaStream | null>(null)
    const currentVideoFileRef = useRef<string | null>(null)
    const durationTimerRef = useRef<NodeJS.Timeout | null>(null)
    const rateTimerRef = useRef<NodeJS.Timeout | null>(null)
    const captureTimerRef = useRef<NodeJS.Timeout | null>(null)

    const [videoQuality, setVideoQuality] = useState<'480p' | '720p' | '1080p'>('720p')
    const [frameRate, setFrameRate] = useState<0.5 | 1>(1)
    const [startTime, setStartTime] = useState<string>('--')
    const [duration, setDuration] = useState<number>(0)
    const [dataTransferred, setDataTransferred] = useState<string>('0 MB')
    const [transmissionRate, setTransmissionRate] = useState<string>('0 KB/s')
    const [resolution, setResolution] = useState<string>('--')
    const [currentFrameRate, setCurrentFrameRate] = useState<string>('--')
    const [lastDataSize, setLastDataSize] = useState<number>(0)

    useEffect(() => {
        isVideoStreamingRef.current = isVideoStreaming
    }, [isVideoStreaming])

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
        if (!video) {
            console.error('捕捉不到视频实例');
            return
        }

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
            console.log('captureFrame', isVideoStreamingRef.current, video.videoWidth, video.videoHeight, isCapturing)
            if (!isVideoStreamingRef.current || !video.videoWidth || !video.videoHeight || isCapturing) return

            console.log('捕获中')

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
                        if (blob && socketRef.current && isVideoStreamingRef.current) {
                            console.log('send video frame')
                            try {
                                const reader = new FileReader()
                                reader.onloadend = () => {
                                    const base64data = reader.result
                                    
                                    socketRef.current?.emit('send_data', {
                                        image_data: base64data,
                                        type: SidebarKey.Stream
                                    })
                                }
                                reader.readAsDataURL(blob)
                            } catch (error) {
                                console.error('发送视频帧失败:', error)
                            }

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
            if (isVideoStreamingRef.current) {
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
        const typeText = streamType === VideoStreamType.Camera ? '摄像头' :
            streamType === VideoStreamType.Screen ? '屏幕录制' : '视频文件'
        addMessage({
            content: `开始${typeText}视频流传输`,
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
        isVideoStreamingRef.current = true

        // 启动定时器和数据传输
        startTimers()
        startDataTransmission()

        // 监听流结束
        stream.getVideoTracks()[0].onended = () => {
            stopStream()
        }
    }

    const setupVideoFile = (fileUrl: string) => {
        currentVideoFileRef.current = fileUrl
        if (videoRef.current) {
            videoRef.current.srcObject = null
            videoRef.current.src = fileUrl
        }

        // 记录开始时间
        const now = new Date()
        setStartTime(now.toLocaleTimeString())
        setDuration(0)
        setLastDataSize(0)

        startVideoStream(VideoStreamType.File)

        // 设置视频流状态
        setIsVideoStreaming(true)
        isVideoStreamingRef.current = true

        // 启动定时器和数据传输
        startTimers()

        // 等待视频元数据加载完成后开始数据传输和更新分辨率信息
        const video = videoRef.current
        if (video) {
            const handleLoadedMetadata = () => {
                setResolution(`${video.videoWidth}x${video.videoHeight}`)
                setCurrentFrameRate(frameRate.toString())
                startDataTransmission()
            }

            if (video.readyState >= 1) { // HAVE_METADATA
                handleLoadedMetadata()
            } else {
                video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
            }

            // 监听视频结束
            video.addEventListener('ended', () => {
                stopStream()
            })
        }
    }

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.type.startsWith('video/')) {
            const fileUrl = URL.createObjectURL(file)
            setupVideoFile(fileUrl)
        } else {
            alert('请选择有效的视频文件')
        }
        // 清空input值，以便重复选择同一个文件
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const triggerFileUpload = () => {
        fileInputRef.current?.click()
    }

    const startCameraStream = async () => {
        try {
            const quality = qualityConfig[videoQuality]
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: quality.width,
                    height: quality.height,
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
            videoRef.current.src = ''
            videoRef.current.load() // 重置video元素
        }

        // 清理视频文件URL
        if (currentVideoFileRef.current) {
            URL.revokeObjectURL(currentVideoFileRef.current)
            currentVideoFileRef.current = null
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

    return (<div className={`bg-background border rounded-lg overflow-y-auto ${className}`}>
        <div className="flex flex-col h-auto gap-4 p-4">
            {/* 上部：视频预览区 */}
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
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white p-1">
                            <div className="flex justify-between text-[10px]">
                                <div className="flex flex-col items-center min-w-0">
                                    <span className="text-gray-300 text-[8px]">分辨率</span>
                                    <span className="font-medium">{resolution}</span>
                                </div>
                                <div className="flex flex-col items-center min-w-0">
                                    <span className="text-gray-300 text-[8px]">帧率</span>
                                    <span className="font-medium">{currentFrameRate} fps</span>
                                </div>
                                <div className="flex flex-col items-center min-w-0">
                                    <span className="text-gray-300 text-[8px]">传输量</span>
                                    <span className="font-medium">{dataTransferred}</span>
                                </div>
                                <div className="flex flex-col items-center min-w-0">
                                    <span className="text-gray-300 text-[8px]">速率</span>
                                    <span className="font-medium">{transmissionRate}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 视频底部信息条 */}
            {isVideoStreaming && (
                <div >
                    <div className="flex flex-col justify-between text-xs">
                        <div className="flex flex-row items-center justify-between min-w-0">
                            <span className="text-gray-400 text-sm">开始时间</span>
                            <span className="font-medium">{startTime}</span>
                        </div>
                        <div className="flex flex-row items-center justify-between min-w-0">
                            <span className="text-gray-400 text-sm">持续时间</span>
                            <span className="font-medium">{formatDuration(duration)}</span>
                        </div>
                    </div>
                </div>
            )}


            {/* 右侧：控制面板 */}
            <div className="w-72 flex flex-col gap-4">
                {/* 流设置控制 */}
                <Card className="gap-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Settings className="h-4 w-4" />
                            流设置
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* 控制按钮 */}
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="secondary"
                                onClick={startCameraStream}
                                disabled={isVideoStreaming}
                                className="flex items-center gap-2"
                            >
                                <Camera className="h-4 w-4" />
                                摄像头
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={startScreenStream}
                                disabled={isVideoStreaming}
                                className="flex items-center gap-2"
                            >
                                <Monitor className="h-4 w-4" />
                                录屏
                            </Button>
                        </div>

                        <Button
                            variant="secondary"
                            onClick={triggerFileUpload}
                            disabled={isVideoStreaming}
                            className="w-full flex items-center"
                        >
                            <Upload className="h-4 w-4" />
                            上传视频文件
                        </Button>

                        <Button
                            onClick={stopStream}
                            disabled={!isVideoStreaming}
                            className="w-full flex items-center gap-2 "
                            variant="destructive"
                        >
                            <Square className="h-4 w-4" />
                            停止传输
                        </Button>

                        <Separator />

                        {/* 质量设置 */}
                        <div className="space-y-3">
                            <div className="space-y-2 flex flex-row items-center justify-between">
                                <div className="text-sm text-muted-foreground mb-0">视频质量:</div>
                                <Select
                                    value={videoQuality}
                                    onValueChange={(value: '480p' | '720p' | '1080p') => setVideoQuality(value)}
                                    disabled={isVideoStreaming}
                                >
                                    <SelectTrigger style={{
                                        width: '150px',
                                        height: '32px',
                                        backgroundColor: '#fff',
                                        fontSize: '12px',
                                        borderColor: '#e4e4e7'
                                    }}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="480p">低 (480p)</SelectItem>
                                        <SelectItem value="720p">中 (720p)</SelectItem>
                                        <SelectItem value="1080p">高 (1080p)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 flex flex-row items-center justify-between">
                                <div className="text-sm text-muted-foreground mb-0">帧率:</div>
                                <Select
                                    value={frameRate.toString()}
                                    onValueChange={(value) => setFrameRate(Number(value) as 0.5 | 1)}
                                    disabled={isVideoStreaming}
                                >
                                    <SelectTrigger style={{
                                        width: '150px',
                                        height: '32px',
                                        backgroundColor: '#fff',
                                        fontSize: '12px',
                                        borderColor: '#e4e4e7'
                                    }}>
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
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="video/*"
            style={{ display: 'none' }}
        />
    </div>
    )
}

export default VideoStream 