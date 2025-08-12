<template>
  <div id="app">
    <ChatView />
  </div>
</template>

<script>
import ChatView from './views/ChatView.vue'

export default {
  name: 'App',
  components: {
    ChatView
  }
}
</script>

<style>
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif;
}

#app {
  height: 100vh;
}

/* 全局样式优化 */
.ui.menu .item {
  cursor: pointer;
}

.ui.card {
  cursor: pointer;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}
</style>
