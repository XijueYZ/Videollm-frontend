import { useState, useRef, useEffect, useContext } from 'react'
import { Send, Bot, User, Wifi, WifiOff } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ChatContext } from '@/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

const Chat = () => {
    const { socketRef, isConnected, messages, setMessages } = useContext(ChatContext)
    const [inputValue, setInputValue] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isTyping])

    const handleSendMessage = () => {
        if (!inputValue.trim() || !isConnected || !socketRef.current) return

        const userMessage = {
            id: Date.now().toString(),
            isUser: true,
            content: inputValue.trim(),
            timestamp: Date.now()
        }

        setMessages(prev => [...prev, userMessage])

        socketRef.current.emit('chat', {
            message: inputValue.trim(),
            timestamp: Date.now()
        })

        setInputValue('')
        setIsTyping(true)
        inputRef.current?.focus()
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background">
            {/* 标题栏 */}
            <div className="p-4 border-b flex flex-row justify-between flex-shrink-0">
                {/* 左边是标题，右边是连接状态 */}
                <div className="text-xl font-bold">离线视频理解</div>
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
            </div>
            <Separator />


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
                                className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'
                                    }`}
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
                                            ? 'bg-primary text-primary-foreground p-2'
                                            : 'bg-muted' + ' p-2'
                                    }>
                                        <CardContent className="p-0">
                                            <div className="whitespace-pre-wrap break-words text-sm">
                                                {message.content}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className={`text-xs text-muted-foreground mt-1 ${message.isUser ? 'text-right' : 'text-left'
                                        }`}>
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

                        {/* 正在输入指示器 */}
                        {isTyping && (
                            <div className="flex gap-3 justify-start">
                                <Avatar>
                                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900">
                                        <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </AvatarFallback>
                                </Avatar>

                                <Card className="bg-muted p-2">
                                    <CardContent className="p-2">
                                        <div className="flex space-x-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            <Separator />

            {/* 输入区域 */}
            <div className="p-4 flex-shrink-0">
                <div className="flex gap-3 items-end">
                    <div className="flex-1">
                        <Textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={isConnected ? "输入消息... " : "等待连接..."}
                            className="min-h-[48px] max-h-32 resize-none"
                            disabled={!isConnected}
                        />
                    </div>
                    <Button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || !isConnected}
                        size="icon"
                        className="h-12 w-12 bg-gray-400"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default Chat