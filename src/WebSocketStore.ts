import { useSyncExternalStore } from 'react';

// 创建一个外部存储类
class WebSocketStore {
  private data: Message[] = [];
  private listeners = new Set<() => void>();

  // 立即更新数据，不会有异步延迟
  updateData(newData: Message[]) {
    this.data = newData;
    // 同步通知所有监听器
    this.listeners.forEach(listener => listener());
  }

  // 添加消息
  addMessage(message: Message) {
    this.data = [...this.data, message];
    this.listeners.forEach(listener => listener());
  }

  // 更新最后一条消息
  updateLastMessage(updater: (message: Message) => Message) {
    if (this.data.length > 0) {
      this.data = this.data.map((message, index) => 
        index === this.data.length - 1 ? updater(message) : message
      );
      this.listeners.forEach(listener => listener());
    }
  }

  // 批量更新消息
  updateMessages(updater: (messages: Message[]) => Message[]) {
    this.data = updater(this.data);
    this.listeners.forEach(listener => listener());
  }

  // 清空消息
  clearMessages() {
    this.data = [];
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.data;
  }
}

// 创建全局实例
const webSocketStore = new WebSocketStore();

// Hook
function useWebSocketData() {
  return useSyncExternalStore(
    webSocketStore.subscribe.bind(webSocketStore),
    webSocketStore.getSnapshot.bind(webSocketStore)
  );
}

// 导出实例和 hook
export { webSocketStore };
export default useWebSocketData; 