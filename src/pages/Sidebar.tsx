import { useActiveKey, webSocketStore } from "@/WebSocketStore"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import type { SidebarKey } from "@/utils"
type Props = {
  items: SideBarItem[]
}
const LeftSideBar: React.FC<Props> = ({ items }) => {
  const activeKey = useActiveKey()
  return (
    <Sidebar collapsible="icon" className="flex-shrink-0" >
      <SidebarContent className="w-full flex-1">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xl font-bold text-primary my-6 py-4">MOSS-Video</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild
                    isActive={activeKey === item.key}>
                    {/* <a > */}
                    <div className="flex items-center gap-2" onClick={() => {
                      webSocketStore.setActiveKey(item.key as SidebarKey);
                      webSocketStore.setIsSwitchingType(true);
                    }
                    }>
                      <item.icon />
                      <span>{item.label}</span>
                    </div>
                    {/* </a> */}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default LeftSideBar;