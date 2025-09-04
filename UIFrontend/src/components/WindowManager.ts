import { webViewCommunication } from "./WebViewCommunication";

export interface WindowManager {
  openProductCatalog: () => void;
  closeProductCatalog: () => void;
  isProductCatalogOpen: () => boolean;
  onProductCatalogStateChange: (callback: (isOpen: boolean) => void) => void;
  openMixbox: () => void;
  closeMixbox: () => void;
  isMixboxOpen: () => boolean;
  onMixboxStateChange: (callback: (isOpen: boolean) => void) => void;
}

class WindowManagerImpl implements WindowManager {
  private productCatalogOpen = false;
  private mixboxOpen = false;
  private productCatalogStateChangeCallback:
    | ((isOpen: boolean) => void)
    | null = null;
  private mixboxStateChangeCallback: ((isOpen: boolean) => void) | null = null;

  private notifyClickableAreas = (): void => {
    setTimeout(() => webViewCommunication.reportClickableAreas(), 100);
  };

  private setWindowOpen = (
    target: "productCatalog" | "mixbox",
    isOpen: boolean
  ): void => {
    if (target === "productCatalog") {
      if (this.productCatalogOpen !== isOpen) {
        this.productCatalogOpen = isOpen;
        this.productCatalogStateChangeCallback?.(isOpen);
        this.notifyClickableAreas();
      }
    } else {
      if (this.mixboxOpen !== isOpen) {
        this.mixboxOpen = isOpen;
        this.mixboxStateChangeCallback?.(isOpen);
        this.notifyClickableAreas();
      }
    }
  };

  openProductCatalog = (): void => {
    this.setWindowOpen("productCatalog", true);
  };

  closeProductCatalog = (): void => {
    this.setWindowOpen("productCatalog", false);
  };

  isProductCatalogOpen = (): boolean => {
    return this.productCatalogOpen;
  };

  onProductCatalogStateChange = (callback: (isOpen: boolean) => void): void => {
    this.productCatalogStateChangeCallback = callback;
  };

  openMixbox = (): void => {
    this.setWindowOpen("mixbox", true);
  };

  closeMixbox = (): void => {
    this.setWindowOpen("mixbox", false);
  };

  isMixboxOpen = (): boolean => {
    return this.mixboxOpen;
  };

  onMixboxStateChange = (callback: (isOpen: boolean) => void): void => {
    this.mixboxStateChangeCallback = callback;
  };
}
export const windowManager: WindowManager = new WindowManagerImpl();
