import { useState, useRef, useEffect, useContext } from 'react'
import { Send, Bot, User, Wifi, WifiOff, Paperclip, X, Image, Video} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ChatContext } from '@/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

const Chat = () => {
    const { socketRef, isConnected, messages, sendMessage } = useContext(ChatContext)
    const [inputValue, setInputValue] = useState('')
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages?.length])

    const handleSendMessage = () => {
        if ((!inputValue.trim() && selectedFiles.length === 0) || !isConnected || !socketRef.current) return
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        sendMessage(inputValue, selectedFiles)
        setInputValue('')
        setSelectedFiles([])
        inputRef.current?.focus()
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        const validFiles = files.filter(file => {
            const isImage = file.type.startsWith('image/')
            const isVideo = file.type.startsWith('video/')
            return isImage || isVideo
        })
        
        if (validFiles.length !== files.length) {
            alert('只支持图片和视频文件')
        }
        
        setSelectedFiles(prev => [...prev, ...validFiles])
        // 清空input，允许重复选择同一文件
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const getFileIcon = (file: File) => {
        if (file.type.startsWith('image/')) {
            return <Image className="h-4 w-4" />
        } else if (file.type.startsWith('video/')) {
            return <Video className="h-4 w-4" />
        }
        return <Paperclip className="h-4 w-4" />
    }

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background">

            {/* 消息区域 */}
            <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                    <Card className="h-full">
                        <CardContent className="flex flex-col items-center justify-center h-full text-center">
                            <Avatar className="h-16 w-16 mb-4">
                                <AvatarFallback>
                                    <Bot className="h-8 w-8" />
                                </AvatarFallback>
                            </Avatar>
                            <h3 className="text-lg font-medium mb-2">开始聊天</h3>
                            <p className="text-muted-foreground max-w-md">
                                发送消息开始与AI助手对话。支持实时问答、文本生成等功能。
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex gap-3 mb-4 ${message.isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                {!message.isUser && (
                                    <Avatar>
                                        <AvatarFallback className="bg-blue-100 dark:bg-blue-900">
                                            <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        </AvatarFallback>
                                    </Avatar>
                                )}

                                <div className={`max-w-[70%] ${message.isUser ? 'order-first' : ''}`}>
                                    <Card className={
                                        message.isUser
                                            ? 'bg-primary text-primary-foreground p-2  max-w-[100%] text-left'
                                            : 'bg-muted' + ' p-2 max-w-[100%] text-left'
                                    }>
                                        <CardContent className="p-0">
                                            <div className="whitespace-pre-wrap break-words text-sm">
                                                {message.content}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className={`text-xs text-muted-foreground mt-1 ${message.isUser ? 'text-right' : 'text-left'}`}>
                                        {new Date(message.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>

                                {message.isUser && (
                                    <Avatar>
                                        <AvatarFallback className="bg-muted">
                                            <User className="h-4 w-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            <Separator />

            {/* 文件预览区域 */}
            {selectedFiles.length > 0 && (
                <div className="p-4 border-b bg-muted/30">
                    <div className="flex flex-wrap gap-2">
                        {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 bg-background rounded-lg p-2 border">
                                {getFileIcon(file)}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{file.name}</div>
                                    <div className="text-xs text-muted-foreground">{formatFileSize(file.size)}</div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeFile(index)}
                                    className="h-6 w-6 p-0 border-destructive/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 输入区域 */}
            <div className="p-4 flex-shrink-0">
                <div className="relative flex items-end gap-2 bg-muted/30 rounded-2xl p-2">
                    <div className="flex-1 relative">
                        <Textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={isConnected ? "输入消息..." : "等待连接..."}
                            className="min-h-[48px] max-h-32 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 pr-20"
                            disabled={!isConnected}
                        />
                        {/* 右侧按钮组 */}
                        <div className="absolute right-2 bottom-2 flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!isConnected}
                                className="h-8 w-8 p-0 rounded-full border-muted-foreground/20 hover:bg-muted hover:border-muted-foreground/30"
                            >
                                <Paperclip className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleSendMessage}
                                disabled={(!inputValue.trim() && selectedFiles.length === 0) || !isConnected}
                                size="sm"
                                className="h-8 w-8 p-0 rounded-full border-primary/20 hover:bg-primary/10 hover:border-primary/30 disabled:border-muted-foreground/10"
                            >
                                <Send className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            </div>
        </div>
    )
}

export default Chat