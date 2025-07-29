import { UserProfile } from '../../core/types';

/**
 * Manages connection state and prevents duplicate connections/ghost characters
 * This is the core solution to the tab switching and ghost character issues
 */
export class ConnectionStateManager {
  private static instance: ConnectionStateManager;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  private currentUser: UserProfile | null = null;
  private connectionId: string | null = null;
  private lastConnectionAttempt: number = 0;
  private connectionCooldown: number = 1000; // 1 second cooldown
  private tabId: string;
  private isPageVisible: boolean = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  
  // Connection state callbacks
  private onStateChangeCallback: ((state: string) => void) | null = null;
  private onReconnectCallback: ((user: UserProfile) => Promise<boolean>) | null = null;
  private onDisconnectCallback: (() => void) | null = null;

  private constructor() {
    // Generate unique tab ID to prevent cross-tab interference
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🆔 Connection state manager initialized with tab ID: ${this.tabId}`);
    
    this.setupPageVisibilityHandling();
    this.setupStorageListener();
  }

  public static getInstance(): ConnectionStateManager {
    if (!ConnectionStateManager.instance) {
      ConnectionStateManager.instance = new ConnectionStateManager();
    }
    return ConnectionStateManager.instance;
  }

  public setCallbacks(
    onStateChange: (state: string) => void,
    onReconnect: (user: UserProfile) => Promise<boolean>,
    onDisconnect: () => void
  ): void {
    this.onStateChangeCallback = onStateChange;
    this.onReconnectCallback = onReconnect;
    this.onDisconnectCallback = onDisconnect;
  }

  public async requestConnection(user: UserProfile): Promise<boolean> {
    const now = Date.now();
    
    // Prevent rapid connection attempts (but allow multiple tabs)
    if (now - this.lastConnectionAttempt < this.connectionCooldown) {
      console.log(`⏰ Connection cooldown active, waiting ${this.connectionCooldown - (now - this.lastConnectionAttempt)}ms`);
      return false;
    }

    // Allow multiple connections per user (different tabs)
    // Only prevent if this specific tab is already connected/connecting
    if (this.connectionState === 'connected') {
      console.log(`🔌 This tab already connected, skipping connection request`);
      return true;
    }
    
    if (this.connectionState === 'connecting') {
      console.log(`🔌 This tab already connecting, skipping connection request`);
      return false;
    }

    this.lastConnectionAttempt = now;
    this.currentUser = user;
    this.setConnectionState('connecting');

    console.log(`✅ Connection request approved for tab ${this.tabId}`);
    return true; // Actual connection will be handled by the caller
  }

  public onConnectionSuccess(connectionId: string): void {
    this.connectionId = connectionId;
    this.setConnectionState('connected');
    this.startHeartbeat();
    
    console.log(`✅ Connection successful for tab ${this.tabId} with ID: ${connectionId}`);
  }

  public onConnectionFailure(): void {
    this.setConnectionState('disconnected');
    console.log(`❌ Connection failed for tab ${this.tabId}`);
  }

  public onDisconnection(reason: string): void {
    console.log(`🔌 Disconnected: ${reason}`);
    
    this.stopHeartbeat();
    
    // Don't immediately reconnect on manual disconnects or page unload
    if (reason === 'io client disconnect' || reason === 'transport close') {
      this.setConnectionState('disconnected');
      this.clearStoredConnection();
      return;
    }

    // For other disconnections, attempt reconnection if page is visible
    if (this.isPageVisible && this.currentUser) {
      this.scheduleReconnection();
    } else {
      this.setConnectionState('disconnected');
    }
  }

  public requestDisconnection(): void {
    this.setConnectionState('disconnected');
    this.currentUser = null;
    this.connectionId = null;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    console.log(`🔌 Disconnection requested for tab ${this.tabId}`);
    
    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }
  }

  public getConnectionState(): string {
    return this.connectionState;
  }

  public getConnectionId(): string | null {
    return this.connectionId;
  }

  public isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  private setConnectionState(state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'): void {
    if (this.connectionState !== state) {
      console.log(`🔄 Connection state: ${this.connectionState} → ${state}`);
      this.connectionState = state;
      
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(state);
      }
    }
  }

  private setupPageVisibilityHandling(): void {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.isPageVisible = !document.hidden;
      
      if (this.isPageVisible) {
        console.log(`👁️ Page visible (${this.tabId})`);
        
        // If we have a user but no connection, attempt reconnection
        if (this.currentUser && this.connectionState === 'disconnected') {
          console.log(`🔄 Page became visible, attempting reconnection`);
          this.scheduleReconnection();
        }
      } else {
        console.log(`😴 Page hidden (${this.tabId})`);
        
        // Don't disconnect immediately, just stop reconnection attempts
        this.clearReconnectTimer();
      }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      console.log(`🚪 Page unloading (${this.tabId})`);
      this.requestDisconnection();
    });

    // Handle page focus/blur for additional tab management
    window.addEventListener('focus', () => {
      console.log(`🎯 Page focused (${this.tabId})`);
      this.isPageVisible = true;
    });

    window.addEventListener('blur', () => {
      console.log(`😴 Page blurred (${this.tabId})`);
      // Don't change isPageVisible here, let visibilitychange handle it
    });
  }

  private setupStorageListener(): void {
    // Listen for storage events to coordinate between tabs
    window.addEventListener('storage', (event) => {
      if (event.key === 'multiplayer_connection_state') {
        const data = event.newValue ? JSON.parse(event.newValue) : null;
        
        if (data && data.tabId !== this.tabId) {
          console.log(`📡 Another tab (${data.tabId}) changed connection state:`, data.state);
          
          // If another tab connected, we should disconnect to prevent conflicts
          if (data.state === 'connected' && this.connectionState === 'connected') {
            console.log(`🚫 Another tab connected, disconnecting this tab to prevent conflicts`);
            this.requestDisconnection();
          }
        }
      }
    });
  }

  // localStorage methods removed - we allow multiple tabs to connect independently

  private scheduleReconnection(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.setConnectionState('reconnecting');
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      if (this.currentUser && this.isPageVisible && this.onReconnectCallback) {
        console.log(`🔄 Attempting reconnection for ${this.currentUser.username}`);
        
        const success = await this.onReconnectCallback(this.currentUser);
        
        if (!success && this.isPageVisible) {
          // Schedule another attempt
          this.scheduleReconnection();
        }
      }
    }, 2000); // 2 second delay for reconnection
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === 'connected') {
        // Heartbeat logic will be handled by NetworkManager
        console.log(`💓 Heartbeat check (${this.tabId})`);
      }
    }, 10000); // Every 10 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public dispose(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.clearStoredConnection();
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', () => {});
    window.removeEventListener('beforeunload', () => {});
    window.removeEventListener('focus', () => {});
    window.removeEventListener('blur', () => {});
    window.removeEventListener('storage', () => {});
  }
}