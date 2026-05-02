/**
 * 公共WebSocket管理器
 * 用于所有管理后台页面的WebSocket连接
 */
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.handlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 3000;
        this.reconnectTimer = null;
        this.onOpen = null;
        this.onClose = null;
        this.onError = null;
        this.host = location.hostname || 'localhost';
        this.port = 8001;
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            const url = `ws://${this.host}:${this.port}`;
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.reconnectAttempts = 0;
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                if (this.onOpen) {
                    this.onOpen();
                }
            };

            this.ws.onclose = () => {
                if (this.onClose) {
                    this.onClose();
                }
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                if (this.onError) {
                    this.onError(error);
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (err) {
                    console.error('解析消息失败:', err, event.data);
                }
            };
        } catch (err) {
            console.error('WebSocket连接失败:', err);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('重连次数已达上限');
            return;
        }

        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => {
            console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            this.connect();
        }, this.reconnectDelay);
    }

    handleMessage(data) {
        // 处理心跳
        if (data.type === 'ping') {
            this.send({ type: 'pong' });
            return;
        }

        // 调用注册的处理器
        const handler = this.handlers.get(data.type);
        if (handler) {
            handler(data);
        }

        // 调用通用处理器（如果存在）
        if (this.handlers.has('*')) {
            this.handlers.get('*')(data);
        }
    }

    send(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket未连接，无法发送消息:', message);
            return false;
        }

        try {
            this.ws.send(JSON.stringify(message));
            return true;
        } catch (err) {
            console.error('发送消息失败:', err);
            return false;
        }
    }

    on(messageType, handler) {
        this.handlers.set(messageType, handler);
    }

    off(messageType) {
        this.handlers.delete(messageType);
    }

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// 创建全局实例
const wsManager = new WebSocketManager();

