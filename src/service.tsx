const httpUrl = 'http://localhost:5000'
// const apiUrl = path + '/5000'

export const apiCall = async (url: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(httpUrl + url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || '请求失败')
    }
    return data
  } catch (error) {
    console.error('API调用失败:', error)
    throw error
  }
}

// 支持取消的API调用
export const apiCallWithAbort = async (url: string, options: RequestInit & { signal?: AbortSignal } = {}) => {
  try {
    const response = await fetch(httpUrl + url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })
    
    // 检查请求是否被取消
    if (options.signal?.aborted) {
      throw new Error('请求已取消')
    }
    
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || '请求失败')
    }
    return data
  } catch (error) {
    if (error instanceof Error && error.message === '请求已取消') {
      console.log('请求被用户取消')
      throw error
    }
    console.error('API调用失败:', error)
    throw error
  }
}