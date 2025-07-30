import { UnifiedBrickSystem } from '../building/UnifiedBrickSystem';

export class LayerProgressUI {
  private container!: HTMLElement;
  private brickSystem: UnifiedBrickSystem;
  private progressText!: HTMLElement;
  private progressBar!: HTMLElement;
  private brickCounterText!: HTMLElement;
  private playerCountText!: HTMLElement;
  private updateInterval: NodeJS.Timeout | null = null;
  private lastDebugLog: number = 0;
  private currentPlayerCount: number = 1;

  constructor(brickSystem: UnifiedBrickSystem) {
    this.brickSystem = brickSystem;
    this.createUI();
    this.startUpdating();
  }

  private createUI(): void {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '10px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.container.style.color = '#ffffff';
    this.container.style.padding = '8px 12px';
    this.container.style.border = '3px solid #ffffff';
    this.container.style.borderRadius = '0px'; // Remove rounded corners for pixelated look
    this.container.style.fontFamily = '"Press Start 2P", monospace';
    this.container.style.fontSize = '8px';
    this.container.style.letterSpacing = '1px';
    this.container.style.textShadow = '2px 2px 0px #000000';
    this.container.style.zIndex = '100';
    this.container.style.width = '220px';
    this.container.style.textAlign = 'center';
    this.container.style.imageRendering = 'pixelated';
    this.container.style.boxShadow = '4px 4px 0px #2d3436, 8px 8px 0px rgba(0,0,0,0.3)';

    this.progressText = document.createElement('div');
    this.progressText.style.marginBottom = '6px';
    this.progressText.style.textTransform = 'uppercase';
    this.container.appendChild(this.progressText);

    // Add brick counter text for layer 1
    this.brickCounterText = document.createElement('div');
    this.brickCounterText.style.fontSize = '6px';
    this.brickCounterText.style.color = '#00d2d3';
    this.brickCounterText.style.marginBottom = '4px';
    this.brickCounterText.style.textShadow = '1px 1px 0px #000000';
    this.brickCounterText.style.letterSpacing = '0.5px';
    this.brickCounterText.style.display = 'none'; // Initially hidden
    this.container.appendChild(this.brickCounterText);

    // Add player count text
    this.playerCountText = document.createElement('div');
    this.playerCountText.style.fontSize = '6px';
    this.playerCountText.style.color = '#FFD700';
    this.playerCountText.style.marginBottom = '4px';
    this.playerCountText.style.textShadow = '1px 1px 0px #000000';
    this.playerCountText.style.letterSpacing = '0.5px';
    this.playerCountText.innerText = '1 builder';
    this.container.appendChild(this.playerCountText);

    const progressBarContainer = document.createElement('div');
    progressBarContainer.style.width = '100%';
    progressBarContainer.style.height = '12px';
    progressBarContainer.style.backgroundColor = '#2d3436';
    progressBarContainer.style.border = '2px solid #ffffff';
    progressBarContainer.style.borderRadius = '0px'; // Pixelated style
    progressBarContainer.style.overflow = 'hidden';
    progressBarContainer.style.marginTop = '4px';
    progressBarContainer.style.imageRendering = 'pixelated';
    this.container.appendChild(progressBarContainer);

    this.progressBar = document.createElement('div');
    this.progressBar.style.width = '0%';
    this.progressBar.style.height = '100%';
    this.progressBar.style.backgroundColor = '#00d2d3'; // Bright cyan color
    this.progressBar.style.transition = 'width 0.3s ease-out';
    this.progressBar.style.imageRendering = 'pixelated';
    this.progressBar.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.3)';
    progressBarContainer.appendChild(this.progressBar);

    document.body.appendChild(this.container);

    this.hide(); // Initially hidden
  }

  private update(): void {
    const currentLayer = this.brickSystem.getCurrentActiveLayer();
    const progress = this.brickSystem.getLayerProgress(currentLayer);

    this.progressText.innerText = `Layer ${currentLayer + 1}`;
    this.progressBar.style.width = `${progress.percentage}%`;

    // Update builder count with proper pluralization
    const builderText = this.currentPlayerCount === 1 ? 'builder' : 'builders';
    this.playerCountText.innerText = `${this.currentPlayerCount} ${builderText}`;

    // Show brick counter for layer 1 (index 0) once brick placement begins
    if (currentLayer === 0 && progress.filled > 0) {
      this.brickCounterText.style.display = 'block';
      this.brickCounterText.innerText = `${progress.filled} bricks out of ${progress.total} bricks`;
    } else {
      this.brickCounterText.style.display = 'none';
    }
    
    // Debug: Log layer update every 10 seconds to avoid spam
    const now = Date.now();
    if (!this.lastDebugLog || now - this.lastDebugLog > 10000) {
      
      this.lastDebugLog = now;
    }
  }

  private startUpdating(): void {
    this.updateInterval = setInterval(() => this.update(), 500);
  }

  public show(): void {
    this.container.style.display = 'block';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public updatePlayerCount(count: number): void {
    
    this.currentPlayerCount = count;
  }

  public dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
