// Mobile debug utility to display debug messages on screen
// TODO: Remove this file after mobile debugging is complete

let debugContainer: HTMLElement | null = null

const createDebugContainer = (): HTMLElement => {
  if (debugContainer) return debugContainer

  debugContainer = document.createElement('div')
  debugContainer.id = 'mobile-debug-container'
  debugContainer.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    right: 10px;
    max-height: 200px;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.9);
    color: #00ff00;
    font-family: monospace;
    font-size: 12px;
    padding: 10px;
    border-radius: 5px;
    z-index: 10000;
    border: 1px solid #333;
  `
  
  // Add close button
  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 3px;
    width: 20px;
    height: 20px;
    cursor: pointer;
    font-size: 12px;
  `
  closeBtn.onclick = () => hideDebug()
  
  debugContainer.appendChild(closeBtn)
  document.body.appendChild(debugContainer)
  
  return debugContainer
}

export const showDebugMessage = (message: string, data?: any): void => {
  const container = createDebugContainer()
  
  const timestamp = new Date().toLocaleTimeString()
  const messageElement = document.createElement('div')
  messageElement.style.cssText = `
    margin-bottom: 5px;
    padding: 2px 0;
    border-bottom: 1px solid #333;
  `
  
  let fullMessage = `[${timestamp}] ${message}`
  if (data) {
    fullMessage += `\n${JSON.stringify(data, null, 2)}`
  }
  
  messageElement.textContent = fullMessage
  container.appendChild(messageElement)
  
  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight
  
  // Keep only last 20 messages
  const messages = container.children
  while (messages.length > 22) { // 20 messages + close button + buffer
    if (messages[1]) { // Skip close button at index 0
      container.removeChild(messages[1])
    }
  }
}

export const hideDebug = (): void => {
  if (debugContainer) {
    document.body.removeChild(debugContainer)
    debugContainer = null
  }
}

export const clearDebug = (): void => {
  if (debugContainer) {
    // Keep only the close button
    while (debugContainer.children.length > 1) {
      debugContainer.removeChild(debugContainer.children[1])
    }
  }
}

// Auto-show debug on mobile
if (typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
  // Auto-create container when module loads on mobile
  setTimeout(() => createDebugContainer(), 1000)
} 