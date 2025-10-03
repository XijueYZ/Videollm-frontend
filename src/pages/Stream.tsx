import { useState, useRef, useEffect, useContext } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ChatContext, SidebarKey } from '@/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import VideoStream from '@/pages/VideoStream'

const Stream = () => {
    const { socketRef, isConnected, messages, sendMessage, isAllocatingModel } = useContext(ChatContext)
    const [inputValue, setInputValue] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages?.length])

    const handleSendMessage = () => {
        if (!inputValue.trim() || !isConnected || !socketRef.current) return
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        sendMessage(inputValue, [], SidebarKey.Stream, undefined)
        setInputValue('')
        inputRef.current?.focus()
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }
    return (
        <div className="flex flex-row h-full flex-1"  style={{ height: 'calc(100% - 29px)'}}>
            <div className="flex flex-col h-full overflow-hidden bg-background flex-1">
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
                                            {message.loading ?
                                                    <div className="flex items-center justify-center">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    </div>
                                                    :
                                                    <div className="whitespace-pre-wrap break-all text-sm">
                                                        {message.content}
                                                    </div>
                                                }
                                            </CardContent>
                                        </Card>

                                        <div className={`text-xs text-muted-foreground mt-1 ${message.isUser ? 'text-right' : 'text-left'}`}>
                                            {new Date(message.timestamp || 0).toLocaleTimeString()}
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
                                disabled={!isConnected || isAllocatingModel}
                            />
                            {/* 右侧按钮组 */}
                            <div className="absolute right-2 bottom-2 flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || !isConnected || isAllocatingModel}
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-full border-primary/20 hover:bg-primary/10 hover:border-primary/30 disabled:border-muted-foreground/10"
                                >
                                    <Send className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <VideoStream className='w-80 flex-shrink-0 flex-grow-0 flex-basis-80 m-2' />
        </div>
    )
}

export default Stream