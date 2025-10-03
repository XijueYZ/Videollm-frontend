import { useSyncExternalStore } from 'react';
import { SidebarKey } from './utils';

// 创建一个外部存储类
class WebSocketStore {
  private streamData: Message[] = [];
  private chatData: Message[] = [];
  private activeKey: SidebarKey = SidebarKey.Chat;
  private listeners = new Set<() => void>();
  // 是否正在切换模型
  private isSwitchingType = false;

  // 设置当前活跃的key
  setActiveKey(newActiveKey: SidebarKey) {
    if (this.activeKey !== newActiveKey) {
      this.activeKey = newActiveKey;
      // 切换时通知监听器更新
      this.listeners.forEach(listener => listener());
    }
  }

  // 获取当前活跃的key
  getActiveKey(): SidebarKey {
    return this.activeKey;
  }

  // 设置当前活跃的数据
  private setCurrentData(newData: Message[]) {
    if (this.activeKey === SidebarKey.Chat) {
      this.chatData = newData;
    } else {
      this.streamData = newData;
    }
  }

  // 获取指定类型的数据
  private getDataByType(type: SidebarKey): Message[] {
    return type === SidebarKey.Chat ? this.chatData : this.streamData;
  }

  // 设置指定类型的数据
  private setDataByType(type: SidebarKey, newData: Message[]) {
    if (type === SidebarKey.Chat) {
      this.chatData = newData;
    } else {
      this.streamData = newData;
    }
  }

  // 立即更新数据，不会有异步延迟
  updateData(newData: Message[], type?: SidebarKey) {
    const targetType = type || this.activeKey;
    this.setDataByType(targetType, newData);
    // 同步通知所有监听器
    this.listeners.forEach(listener => listener());
  }

  // 添加消息
  addMessage(message: Message, type?: SidebarKey) {
    const targetType = type || this.activeKey;
    const currentData = this.getDataByType(targetType);
    this.setDataByType(targetType, [...currentData, message]);
    this.listeners.forEach(listener => listener());
  }

  // 更新最后一条消息
  updateLastMessage(updater: (message: Message) => Message, type?: SidebarKey) {
    const targetType = type || this.activeKey;
    const currentData = this.getDataByType(targetType);
    if (currentData.length > 0) {
      const newData = currentData.map((message, index) =>
        index === currentData.length - 1 ? updater(message) : message
      );
      this.setDataByType(targetType, newData);
      this.listeners.forEach(listener => listener());
    }
  }

  // 批量更新消息
  updateMessages(updater: (messages: Message[]) => Message[], type?: SidebarKey) {
    const targetType = type || this.activeKey;
    const currentData = this.getDataByType(targetType);
    const newData = updater(currentData);
    this.setDataByType(targetType, newData);
    this.listeners.forEach(listener => listener());
  }

  // 清空当前活跃的消息
  clearMessages() {
    this.setCurrentData([]);
    this.listeners.forEach(listener => listener());
  }

  // 清空指定类型的消息
  clearMessagesByType(type: SidebarKey) {
    this.setDataByType(type, []);
    this.listeners.forEach(listener => listener());
  }

  // 清空所有消息
  clearAllMessages() {
    this.chatData = [];
    this.streamData = [];
    this.listeners.forEach(listener => listener());
  }

  // 删除最后一条消息
  deleteLastMessage() {
    const currentData = this.getDataByType(this.activeKey);
    if (currentData.length > 0) {
      this.setDataByType(this.activeKey, currentData.slice(0, -1));
    }
    this.listeners.forEach(listener => listener());
  }

  // 获取指定类型的数据（公开方法）
  getDataByKey(key: SidebarKey): Message[] {
    return this.getDataByType(key);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.activeKey === SidebarKey.Chat ? this.chatData : this.streamData;
  }

  // 获取activeKey的快照（用于Hook）
  getActiveKeySnapshot() {
    return this.activeKey;
  }

  setIsSwitchingType(type: boolean) {
    this.isSwitchingType = type;
  }

  getIsSwitchingType() {
    return this.isSwitchingType;
  }
}

// 创建全局实例
const webSocketStore = new WebSocketStore();

// Hook - 返回当前活跃key的数据
function useWebSocketData() {
  return useSyncExternalStore(
    webSocketStore.subscribe.bind(webSocketStore),
    webSocketStore.getSnapshot.bind(webSocketStore)
  );
}

// Hook - 返回当前活跃的key
function useActiveKey() {
  return useSyncExternalStore(
    webSocketStore.subscribe.bind(webSocketStore),
    webSocketStore.getActiveKeySnapshot.bind(webSocketStore)
  );
}

// Hook - 返回指定类型的数据
function useWebSocketDataByKey(key: SidebarKey) {
  return useSyncExternalStore(
    webSocketStore.subscribe.bind(webSocketStore),
    () => webSocketStore.getDataByKey(key)
  );
}

// 导出实例和 hook
export { webSocketStore, useActiveKey, useWebSocketDataByKey };
export default useWebSocketData;