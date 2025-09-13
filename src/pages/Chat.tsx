import { useState, useRef, useEffect, useContext } from 'react'
import { Send, Bot, User, Paperclip, X, Pause } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ChatContext, formatFileSize, SidebarKey } from '@/utils'
import { Card, CardContent, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FilePreview } from '@/components/ui/videoPreview'
import { webSocketStore } from '@/WebSocketStore'

const Chat = (props: { collapseSettings: boolean, setCollapseSettings: (collapseSettings: boolean) => void, isChatOutputting: boolean }) => {
    const { collapseSettings, setCollapseSettings, isChatOutputting } = props
    const { socketRef, isConnected, messages, sendMessage } = useContext(ChatContext)
    const [inputValue, setInputValue] = useState('')
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [topP, setTopP] = useState(0.95)
    const [temperature, setTemperature] = useState(1)
    const [topK, setTopK] = useState(1.0)
    const [videoFps, setVideoFps] = useState(1.0)
    const [videoMinLen, setVideoMinLen] = useState(8)
    const [videoMaxLen, setVideoMaxLen] = useState(256)
    const [outputLength, setOutputLength] = useState(1024)
    const [repetitionPenalty, setRepetitionPenalty] = useState(1.0)
    const [thinkingMode, setThinkingMode] = useState(false)

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
        // 判断selectedFiles里面有没有视频
        const hasVideo = selectedFiles.some(file => file.type.startsWith('video/'))
        sendMessage(inputValue, selectedFiles, SidebarKey.Chat, {
            media_kwargs: {
                video_fps: videoFps,
                video_minlen: videoMinLen,
                video_maxlen: videoMaxLen,
            },
            generate_kwargs: {
                temperature: temperature,
                top_k: topK,
                top_p: topP,
                max_new_tokens: outputLength,
                repetition_penalty: repetitionPenalty,
            },
            thinking_mode: thinkingMode ? 'deep_thinking' : 'no_thinking',
            system_prompt_type: hasVideo ? 'video' : 'text_image'
        })
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
        const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
        
        const validFiles: File[] = []
        const invalidFiles: string[] = []
        const oversizedFiles: string[] = []
        
        files.forEach(file => {
            const isImage = file.type.startsWith('image/')
            const isVideo = file.type.startsWith('video/')
            
            // 检查文件类型
            if (!isImage && !isVideo) {
                invalidFiles.push(file.name)
                return
            }
            
            // 检查文件大小
            if (file.size > MAX_FILE_SIZE) {
                oversizedFiles.push(`${file.name} (${formatFileSize(file.size)})`)
                return
            }
            
            validFiles.push(file)
        })

        // 显示错误信息
        if (invalidFiles.length > 0) {
            alert(`以下文件格式不支持，只支持图片和视频文件：\n${invalidFiles.join(', ')}`)
        }
        
        if (oversizedFiles.length > 0) {
            alert(`以下文件超过50MB限制：\n${oversizedFiles.join('\n')}`)
        }

        // 只添加有效的文件
        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles])
        }
        
        // 清空input，允许重复选择同一文件
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    }

    return (
        <div className="flex flex-row h-full flex-1"  style={{ height: 'calc(100% - 29px)'}}>
            <div className="flex flex-col h-full overflow-hidden bg-background flex-1" >

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
                                                <div className="whitespace-pre-wrap break-all text-sm">
                                                    {message.content}
                                                </div>
                                                {message?.files?.map((file, index) => (
                                                    <FilePreview
                                                        key={index}
                                                        file={file}
                                                    />
                                                ))}
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

                {/* 文件预览区域 - 更新这部分 */}
                {selectedFiles.length > 0 && (
                    <div className="p-4 border-b bg-muted/30">
                        <div className="flex flex-wrap gap-3">
                            {selectedFiles.map((file, index) => (
                                <FilePreview
                                    key={index}
                                    file={file}
                                    onRemove={() => removeFile(index)}
                                />
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
                                    // TODO:
                                    // disabled={!isConnected}
                                    className="h-8 w-8 p-0 rounded-full border-muted-foreground/20 hover:bg-muted hover:border-muted-foreground/30"
                                >
                                    <Paperclip className="h-4 w-4" />
                                </Button>
                                {!isChatOutputting ? <Button
                                    variant="outline"
                                    onClick={handleSendMessage}
                                    // TODO:
                                    // disabled={(!inputValue.trim() && selectedFiles.length === 0) || !isConnected}
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-full border-primary/20 hover:bg-primary/10 hover:border-primary/30 disabled:border-muted-foreground/10"
                                >
                                    <Send className="h-3 w-3" />
                                </Button> :
                                    // 正在输出的时候展示暂停按钮
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            socketRef.current?.emit('pause_offline_output')
                                        }}
                                        size="sm"
                                        className="h-8 w-8 p-0 rounded-full border-primary/20 hover:bg-primary/10 hover:border-primary/30"
                                    >
                                        <Pause className="h-3 w-3" />
                                    </Button>
                                }
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
            <div className={`transition-all duration-300 ease-in-out ${collapseSettings ? 'w-0' : 'w-[300px] border-l-1'
                }`} style={{ height: 'calc(100vh - 32px)' }}>
                <div className="h-full p-4 pt-2 pr-0 w-full overflow-y-auto">
                    <div className='flex flex-row justify-between align-middle'>
                        <Label htmlFor='setting'>Settings</Label>
                        {/* 关闭按钮 */}
                        <Button variant="ghost" size="sm" onClick={() => setCollapseSettings(true)}>
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                    <div>
                        <Card className='mt-2 mb-4 p-2' style={{ textAlign: 'left', alignItems: 'flex-start', borderRadius: '8px' }}>
                            <CardContent className='w-full text-left p-2'>
                                <Label htmlFor='moss-videollm' className='pb-2'>MOSS-Videollm</Label>
                                <CardDescription>description</CardDescription>
                            </CardContent>
                        </Card>
                        <form>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="top-p">Temprature</Label>
                                <div className="flex items-center justify-between space-x-2">
                                    <Slider
                                        value={[temperature]}
                                        onValueChange={(value) => setTemperature(value[0])}
                                        max={2}
                                        min={0}
                                        step={0.05}
                                        className="w-[180px]"
                                    />
                                    <Input
                                        id="top-p"
                                        type="number"
                                        value={temperature}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value)
                                            if (!isNaN(value) && value >= 0 && value <= 1) {
                                                setTemperature(value)
                                            }
                                        }}
                                        min="0"
                                        max="2"
                                        step="0.01"
                                        className="w-[80px] p-[6px] h-[24px] text-center text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                    />
                                </div>
                                <div className="flex flex-row justify-between space-y-1.5 mt-2">
                                    <Label htmlFor="mode">Media Solutions</Label>
                                    <Select value="Default">
                                        <SelectTrigger className='w-[120px] h-[24px]'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Default">Default</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Separator className='mt-4 mb-6' />
                            <div className="flex flex-col space-y-3">
                                <div className="text-xs text-left text-gray-400 mb-6">Media KWargs</div>
                                <div className="flex flex-row justify-between items-center">
                                    <Label htmlFor="video-fps">video fps</Label>
                                    <Input type="number" id="video-fps" className="w-[120px] h-[24px]" value={videoFps} onChange={(e) => {
                                        const value = parseFloat(e.target.value)
                                        if (!isNaN(value)) {
                                            setVideoFps(value)
                                        }
                                    }} />
                                </div>
                                <div className="flex flex-row justify-between items-center">
                                    <Label htmlFor="video-minlen">video minLen</Label>
                                    <Input type='number' id="video-minlen" className="w-[120px] h-[24px]" value={videoMinLen} onChange={(e) => {
                                        const value = parseFloat(e.target.value)
                                        if (!isNaN(value)) {
                                            setVideoMinLen(value)
                                        }
                                    }
                                    } />
                                </div>
                                <div className="flex flex-row justify-between items-center">
                                    <Label htmlFor="video-maxlen">video maxLen</Label>
                                    <Input id="video-maxlen" className="w-[120px] h-[24px]" value={videoMaxLen} onChange={(e) => {
                                        const value = parseFloat(e.target.value)
                                        if (!isNaN(value)) {
                                            setVideoMaxLen(value)
                                        }
                                    }} />
                                </div>
                            </div>
                            <Separator className='mt-4 mb-6' />
                            <div className="text-xs text-left text-gray-400 mb-4">Thinking</div>
                            <div className="flex flex-row justify-between space-y-1.5">
                                <Label htmlFor="mode">Thinking Mode</Label>
                                <Switch id="thinking-mode" checked={thinkingMode} onCheckedChange={setThinkingMode} disabled={webSocketStore.getSnapshot().length > 0} />
                            </div>
                            <Separator className='mt-2 mb-6' />
                            <div className="text-xs text-left text-gray-400 mb-4">Advanced settings</div>
                            <div className="grid w-full items-center gap-4 mb-4">
                                <div className="flex flex-row justify-between items-center">
                                    <Label htmlFor="top-p">Output Length</Label>
                                    <Input id="output-length" className="w-[120px] h-[24px]" value={outputLength} onChange={(e) => {
                                        const value = parseFloat(e.target.value)
                                        if (!isNaN(value)) {
                                            setOutputLength(value)
                                        }
                                    }} />
                                </div>
                            </div>
                            <div className="flex flex-col space-y-1.5 mb-2">
                                <Label htmlFor="top-p">Top P</Label>
                                <div className="flex items-center justify-between space-x-2">
                                    <Slider
                                        value={[topP]}
                                        onValueChange={(value) => setTopP(value[0])}
                                        max={1}
                                        min={0}
                                        step={0.05}
                                        className="w-[180px]"
                                    />
                                    <Input
                                        id="top-p"
                                        type="number"
                                        value={topP}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value)
                                            if (!isNaN(value) && value >= 0 && value <= 1) {
                                                setTopP(value)
                                            }
                                        }}
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        className="w-[80px] h-[24px] p-[6px] text-center text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col space-y-1.5 mb-6">
                                <Label htmlFor="top-k">Top K</Label>
                                <div className="flex items-center justify-between space-x-2">
                                    <Slider
                                        value={[topK]}
                                        onValueChange={(value) => setTopK(value[0])}
                                        max={1}
                                        min={0}
                                        step={0.05}
                                        className="w-[180px]"
                                    />
                                    <Input
                                        id="top-k"
                                        type="number"
                                        value={topK}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value)
                                            if (!isNaN(value) && value >= 0 && value <= 1) {
                                                setTopK(value)
                                            }
                                        }}
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        className="w-[80px] h-[24px] p-[6px] text-center text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                    />
                                </div>
                            </div>
                            <div className="grid w-full items-center gap-4 mb-4">
                                <div className="flex flex-row justify-between items-center">
                                    <Label htmlFor="top-p">Repetition Penalty</Label>
                                    <Input id="output-length" className="w-[120px] h-[24px]" value={repetitionPenalty} onChange={(e) => {
                                        const value = parseFloat(e.target.value)
                                        if (!isNaN(value)) {
                                            setRepetitionPenalty(value)
                                        }
                                    }} />
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div >
        </div >
    )
}

export default Chat