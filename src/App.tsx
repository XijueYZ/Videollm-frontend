import { useState } from 'react'
import './App.css'
import { SidebarKey } from './utils'
import { Home, MessageCircle } from 'lucide-react'
import LeftSideBar from './pages/Sidebar'
import { SidebarProvider } from './components/ui/sidebar'
import ChatView from './ChatView'

const defaultItems: SideBarItem[] = [
  {
    label: 'Stream',
    key: SidebarKey.Stream,
    icon: Home
  },
  {
    label: 'Chat',
    key: SidebarKey.Chat,
    icon: MessageCircle
  }
]

function App() {
  const [activeKey, setActiveKey] = useState(SidebarKey.Stream)

  return <div>
    <SidebarProvider>
      <LeftSideBar items={defaultItems} activeKey={activeKey} setActiveKey={setActiveKey} />
      {/* 根据activeKey显示不同的组件 */}
      <ChatView type={activeKey} />
    </SidebarProvider>
  </div>
}

export default App
