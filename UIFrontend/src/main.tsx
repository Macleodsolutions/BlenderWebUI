import "./index.css";
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import ProductCatalogWindow from "./components/product-catalog/ProductCatalogWindow";
import MixboxWindow from "./components/mixbox/MixboxWindow";
import { windowManager } from "./components/WindowManager";
import type { DockInfo, BlenderLayout, LayoutData } from "./types";
import { webViewCommunication } from "./components/WebViewCommunication";
import { anchorZonesManager } from "./components/AnchorZonesManager";
import { dragDropManager } from "./components/DragDropManager";

let currentDockInfo: DockInfo | null = null;
let blenderLayout: BlenderLayout | null = null;
let lastLayoutData: LayoutData | null = null;

const toolbar = document.getElementById("toolbar") as HTMLElement;
const dragHandle = document.getElementById("dragHandle") as HTMLElement;

const toolActions = {
  render: () => {
    windowManager.openProductCatalog();
  },
  camera: () => {
    windowManager.openMixbox();
  },
} as const;

document.querySelectorAll<HTMLElement>(".tool-button").forEach((button) => {
  button.addEventListener("click", (event) => {
    const tool = (event.currentTarget as HTMLElement).getAttribute(
      "data-tool"
    ) as keyof typeof toolActions;

    toolActions[tool]?.();
  });
});
dragDropManager.initialize(dragHandle, toolbar);

dragDropManager.onDragStart(() => {
  if (lastLayoutData) {
    anchorZonesManager.createAnchorZones(lastLayoutData, true);
  }
});

dragDropManager.onDragEnd((dockZone) => {
  if (dockZone && lastLayoutData) {
    const dockInfo = anchorZonesManager.dockToolbar(
      dockZone,
      toolbar,
      lastLayoutData
    );

    if (dockInfo) currentDockInfo = dockInfo;
  }
});

webViewCommunication.initialize();
webViewCommunication.onLayoutReceived((layout: BlenderLayout) => {
  blenderLayout = layout;
  updateAnchorZones();
});

function updateAnchorZones(): void {
  const layoutWindow = blenderLayout?.windows?.[0];
  const areas = layoutWindow?.screen?.areas;

  if (!layoutWindow || !areas?.length) return;
  lastLayoutData = { window: layoutWindow, areas };

  anchorZonesManager.createAnchorZones(
    lastLayoutData,
    dragDropManager.isDragging()
  );

  if (currentDockInfo && lastLayoutData && !dragDropManager.isDragging()) {
    anchorZonesManager.updateDockedToolbarPosition(
      currentDockInfo,
      lastLayoutData,
      toolbar
    );
  }
}

webViewCommunication.startClickableAreasReporting(2000);

export const UIOverlay: React.FC = () => {
  const [isProductCatalogOpen, setIsProductCatalogOpen] = useState(
    windowManager.isProductCatalogOpen()
  );
  const [isMixboxOpen, setIsMixboxOpen] = useState(
    windowManager.isMixboxOpen()
  );

  useEffect(() => {
    windowManager.onProductCatalogStateChange(setIsProductCatalogOpen);
    windowManager.onMixboxStateChange(setIsMixboxOpen);
  }, []);

  return (
    <>
      <ProductCatalogWindow
        isOpen={isProductCatalogOpen}
        onClose={windowManager.closeProductCatalog}
      />
      <MixboxWindow isOpen={isMixboxOpen} onClose={windowManager.closeMixbox} />
    </>
  );
};

const rootElement = document.getElementById("react-root");

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <UIOverlay />
    </React.StrictMode>
  );
}
