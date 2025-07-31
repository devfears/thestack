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
      
      return false;
    }

    // Allow multiple connections per user (different tabs)
    // Only prevent if this specific tab is already connected/connecting
    if (this.connectionState === 'connected') {
      
      return true;
    }
    
    if (this.connectionState === 'connecting') {
      
      return false;
    }

    this.lastConnectionAttempt = now;
    this.currentUser = user;
    this.setConnectionState('connecting');

    return true; // Actual connection will be handled by the caller
  }

  public onConnectionSuccess(connectionId: string): void {
    this.connectionId = connectionId;
    this.setConnectionState('connected');
    this.startHeartbeat();
    
  }

  public onConnectionFailure(): void {
    this.setConnectionState('disconnected');
    
  }

  public onDisconnection(reason: string): void {
    
    this.stopHeartbeat();
    
    // Don't immediately reconnect on manual disconnects or page unload
    if (reason === 'io client disconnect' || reason === 'transport close') {
      this.setConnectionState('disconnected');
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
      
      this.connectionState = state;
      
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(state);
      }
    }
  }

  private setupPageVisibilityHandling(): void {
    // DISABLED: Page visibility handling interferes with multi-tab testing
    // The SimpleMultiplayerSystem now handles tab switching properly
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.isPageVisible = !document.hidden;
      
      // Only log visibility changes, don't trigger reconnections
      console.log(`👁️ ConnectionStateManager: Tab ${this.isPageVisible ? 'visible' : 'hidden'}`);
      
      // Don't auto-reconnect on visibility changes for multi-tab support
      // if (this.isPageVisible) {
      //   if (this.currentUser && this.connectionState === 'disconnected') {
      //     this.scheduleReconnection();
      //   }
      // } else {
      //   this.clearReconnectTimer();
      // }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      
      this.requestDisconnection();
    });

    // Handle page focus/blur for additional tab management
    window.addEventListener('focus', () => {
      
      this.isPageVisible = true;
    });

    window.addEventListener('blur', () => {
      
      // Don't change isPageVisible here, let visibilitychange handle it
    });
  }

  private setupStorageListener(): void {
    // Listen for storage events to coordinate between tabs
    window.addEventListener('storage', (event) => {
      if (event.key === 'multiplayer_connection_state') {
        const data = event.newValue ? JSON.parse(event.newValue) : null;
        
        if (data && data.tabId !== this.tabId) {
          
          // If another tab connected, we should disconnect to prevent conflicts
          if (data.state === 'connected' && this.connectionState === 'connected') {
            
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
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', () => {});
    window.removeEventListener('beforeunload', () => {});
    window.removeEventListener('focus', () => {});
    window.removeEventListener('blur', () => {});
    window.removeEventListener('storage', () => {});
  }
}
