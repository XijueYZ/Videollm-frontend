import { useState } from "react"
import { useActiveKey, webSocketStore } from "@/WebSocketStore"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import type { SidebarKey } from "@/utils"

type Props = {
  items: SideBarItem[]
}

const LeftSideBar: React.FC<Props> = ({ items }) => {
  const activeKey = useActiveKey()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['chat']))
  
  const toggleExpanded = (key: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }
  
  return (
    <Sidebar collapsible="icon" className="flex-shrink-0" >
      <SidebarContent className="w-full flex-1">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xl font-bold text-primary my-6 py-4">MOSS-Video</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {items.map((item) => (
                <div key={item.label}>
                  <SidebarMenuItem>
                    {item.conversations ? (
                      <div>
                        {/* 主菜单项和展开触发器分开 */}
                        <div className="flex items-center">
                          <SidebarMenuButton
                            isActive={activeKey === item.key}
                            className="flex-1 justify-start"
                            onClick={() => {
                              webSocketStore.setActiveKey(item.key as SidebarKey);
                              webSocketStore.setIsSwitchingType(true);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </div>
                          </SidebarMenuButton>
                          
                          {/* 独立的展开/收起触发器 */}
                          <button
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpanded(item.key)
                            }}
                          >
                            {expandedItems.has(item.key) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        
                        {/* 二级菜单 */}
                        {expandedItems.has(item.key) && (
                          <div className="ml-6 mt-1 space-y-0.5">
                            
                            {/* 对话历史列表 */}
                            {item.conversations?.map((conv) => {
                              const isCurrentConversation = conv.id === item.currentConversationId
                              return (
                                <SidebarMenuButton
                                  key={conv.id}
                                  className={`p-4 w-full justify-between text-sm group h-7 ${
                                    isCurrentConversation 
                                      ? 'text-gray-900 font-semibold' 
                                      : 'text-gray-400 hover:text-gray-900'
                                  }`}
                                  style={{
                                    backgroundColor: isCurrentConversation ? '#f5f5f5' : 'transparent',
                                    borderRadius: '12px',
                                  }}
                                  onClick={() => item.onLoadConversation?.(conv.id)}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm truncate">{conv.title}</div>
                                  </div>
                                  <Trash2 
                                    className={`h-3 w-3 opacity-0 group-hover:opacity-100 ml-2 text-red-400`}
                                    onClick={(e) => {
                                      console.log(conv)
                                      e.stopPropagation()
                                      item.onDeleteConversation?.(conv.id)
                                    }}
                                  />
                                </SidebarMenuButton>
                              )
                            })}
                            
                            {(!item.conversations || item.conversations.length === 0) && (
                              <div className="text-xs text-gray-400 px-3 py-1">
                                暂无对话历史
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <SidebarMenuButton
                        isActive={activeKey === item.key}
                        onClick={() => {
                          webSocketStore.setActiveKey(item.key as SidebarKey);
                          webSocketStore.setIsSwitchingType(true);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </div>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                </div>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default LeftSideBar;