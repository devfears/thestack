export class UIManager {
  private container: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '10px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.zIndex = '100';
    container.appendChild(this.container);
  }

  public showToast(message: string, duration: number = 3000): void {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.marginBottom = '5px';
    this.container.appendChild(toast);

    setTimeout(() => {
      this.container.removeChild(toast);
    }, duration);
  }
}