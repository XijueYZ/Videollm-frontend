import { useState } from 'react'
import './App.css'
import { SidebarKey } from './utils'
import { Home, MessageCircle } from 'lucide-react'
import LeftSideBar from './Sidebar'
import { SidebarProvider } from './components/ui/sidebar'

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
      <main>

      </main>
    </SidebarProvider>
  </div>
}

export default App
