/**
 * 路由字典 - 与服务器端 Dictionary 服务对应
 * 用于压缩路由字符串，减少网络传输
 * 参考 PomeloServer 的 Dictionary 组件
 */
export class RouteDictionary {
    private static instance: RouteDictionary = null!;
    private routeToId: Map<string, number> = new Map();
    private idToRoute: Map<number, string> = new Map();
    private version: string = '';
    private enabled: boolean = false;
    
    public static getInstance(): RouteDictionary {
        if (!this.instance) {
            this.instance = new RouteDictionary();
        }
        return this.instance;
    }
    
    /**
     * 加载字典（从服务器或本地文件）
     */
    public loadDictionary(dict: { 
        version: string; 
        route_to_id: { [key: string]: number }; 
        id_to_route: { [key: string]: string } 
    }): void {
        this.version = dict.version;
        this.routeToId.clear();
        this.idToRoute.clear();
        
        // 加载 route_to_id
        for (const [route, id] of Object.entries(dict.route_to_id)) {
            this.routeToId.set(route, id);
        }
        
        // 加载 id_to_route（注意：JSON 的 key 是字符串，需要转换）
        for (const [idStr, route] of Object.entries(dict.id_to_route)) {
            const id = parseInt(idStr, 10);
            if (!isNaN(id)) {
                this.idToRoute.set(id, route);
            }
        }
        
        this.enabled = true;
        console.log(`✅ [RouteDictionary] 字典加载成功，版本: ${this.version}，路由数: ${this.routeToId.size}`);
    }
    
    /**
     * 编码路由（字符串 -> 数字）
     */
    public encodeRoute(route: string): number | null {
        return this.routeToId.get(route) || null;
    }
    
    /**
     * 解码路由（数字 -> 字符串）
     */
    public decodeRoute(routeId: number): string | null {
        return this.idToRoute.get(routeId) || null;
    }
    
    /**
     * 获取字典版本
     */
    public getVersion(): string {
        return this.version;
    }
    
    /**
     * 是否启用字典压缩
     */
    public isEnabled(): boolean {
        return this.enabled;
    }
    
    /**
     * 启用/禁用字典压缩
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}

