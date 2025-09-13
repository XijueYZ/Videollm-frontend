import { Video, X, Image } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "./button"

// 添加文件预览组件
export const FilePreview = ({ file, onRemove }: { file: File, onRemove?: () => void }) => {
    const [previewUrl, setPreviewUrl] = useState<string>('')
    const [isPlaying, setIsPlaying] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        // 创建预览URL
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)

        // 清理函数
        return () => {
            URL.revokeObjectURL(url)
        }
    }, [file])

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    const handleVideoClick = (e: React.MouseEvent) => {
        e.stopPropagation() // 防止事件冒泡
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause()
            } else {
                videoRef.current.play()
            }
        }
    }

    const handleVideoPlay = () => {
        setIsPlaying(true)
    }

    const handleVideoPause = () => {
        setIsPlaying(false)
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <div className="relative bg-background rounded-lg border overflow-hidden">
            {/* 预览内容 */}
            <div className="relative">
                {isImage && previewUrl && (
                    <img
                        src={previewUrl}
                        alt={file.name}
                        className="w-32 h-32 object-cover"
                        onError={() => console.error('图片加载失败')}
                    />
                )}

                {isImage && !previewUrl && (
                    // 图片加载中的占位符
                    <div className="w-32 h-32 bg-muted flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground animate-pulse" />
                    </div>
                )}
                
                {isVideo && (
                    <div className="relative w-32 h-32">
                        {previewUrl ? (
                            <video
                                ref={videoRef}
                                src={previewUrl}
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={handleVideoClick}
                                onPlay={handleVideoPlay}
                                onPause={handleVideoPause}
                                muted
                                playsInline
                                preload="metadata"
                            />
                        ) : (
                            // 视频加载中的占位符
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                                <Video className="h-8 w-8 text-muted-foreground animate-pulse" />
                            </div>
                        )}
                        
                        {/* 播放/暂停按钮覆盖层 */}
                        {previewUrl && !isPlaying && (
                            <div 
                                className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                                onClick={handleVideoClick}
                            >
                                <div className="bg-white/90 rounded-full p-3 hover:bg-white transition-colors">
                                    <svg className="h-6 w-6 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z"/>
                                    </svg>
                                </div>
                            </div>
                        )}
                        
                        {/* 视频标识 */}
                        {previewUrl && (
                            <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                                <Video className="h-3 w-3 inline mr-1" />
                                视频
                            </div>
                        )}
                    </div>
                )}

                {/* 删除按钮 */}
                {onRemove && <Button
                    variant="outline"
                    size="sm"
                    onClick={onRemove}
                    className="absolute top-1 right-1 h-3 w-3 p-0 bg-white/80 hover:bg-white border-destructive/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                >
                    <X className="h-3 w-3" />
                </Button>}
            </div>

            {/* 文件信息 */}
            <div className="p-2 border-t">
                <div className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                </div>
            </div>
        </div>
    )
}