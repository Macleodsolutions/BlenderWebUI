import type { BlenderLayout } from "../types";

interface WebView2 {
  postMessage: (message: string) => void;
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<string>) => void
  ) => void;
}
interface WindowWithWebview extends Window {
  chrome?: { webview?: WebView2 };
}
export interface WebViewCommunication {
  initialize: () => void;
  startClickableAreasReporting: (intervalMs?: number) => void;
  stopClickableAreasReporting: () => void;
  reportClickableAreas: () => void;
  sendMessage: (message: string) => void;
  onLayoutReceived: (callback: (layout: BlenderLayout) => void) => void;
}
class WebViewCommunicationImpl implements WebViewCommunication {
  private layoutCallback: ((layout: BlenderLayout) => void) | null = null;
  private reportingInterval: number | null = null;
  private get webview(): WebView2 | undefined {
    return (window as WindowWithWebview).chrome?.webview;
  }

  initialize(): void {
    if (!this.webview) {
      return;
    }

    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    this.webview?.addEventListener("message", (event: MessageEvent<string>) => {
      try {
        const blenderLayout: BlenderLayout = JSON.parse(event.data);

        this.layoutCallback?.(blenderLayout);
      } catch {
        return;
      }
    });
  }

  startClickableAreasReporting(intervalMs: number = 2000): void {
    this.stopClickableAreasReporting();
    this.reportingInterval = window.setInterval(() => {
      this.reportClickableAreas();
    }, intervalMs);
    this.reportClickableAreas();
  }

  stopClickableAreasReporting(): void {
    if (this.reportingInterval !== null) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }
  }

  reportClickableAreas(): void {
    const clickableAreas =
      document.querySelectorAll<HTMLElement>(".clickable-area");
    const rects = Array.from(clickableAreas)
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map(
        (rect) =>
          `[${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(
            rect.width
          )},${Math.round(rect.height)}]`
      )
      .join("");

    this.sendMessage(rects);
  }

  sendMessage(message: string): void {
    if (this.webview) {
      this.webview.postMessage(message);
    }
  }

  onLayoutReceived(callback: (layout: BlenderLayout) => void): void {
    this.layoutCallback = callback;
  }
}
export const webViewCommunication: WebViewCommunication =
  new WebViewCommunicationImpl();
