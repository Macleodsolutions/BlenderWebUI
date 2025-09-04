import type { LayoutData, DockInfo, DockPosition, BlenderArea } from "../types";

export interface AnchorZonesManager {
  createAnchorZones: (layoutData: LayoutData, isDragging: boolean) => void;
  dockToolbar: (
    zone: HTMLElement,
    toolbarElement: HTMLElement,
    layoutData: LayoutData
  ) => DockInfo | null;
  updateDockedToolbarPosition: (
    dockInfo: DockInfo,
    layoutData: LayoutData,
    toolbarElement: HTMLElement
  ) => void;
  clearAnchorZones: () => void;
}
interface ToolbarPosition {
  x: number;
  y: number;
  transform?: string;
  transformOrigin?: string;
}
class AnchorZonesManagerImpl implements AnchorZonesManager {
  createAnchorZones(layoutData: LayoutData, isDragging: boolean = false): void {
    this.clearAnchorZones();

    const blenderWindowHeight = layoutData.window.height;
    const cornerSize = 40;
    const sideThickness = 20;

    const fragment = document.createDocumentFragment();

    layoutData.areas.forEach((area, areaIndex) => {
      const zoneConfigs = [
        ["corner-top-left", area.x, area.y, cornerSize, cornerSize],
        [
          "corner-top-right",
          area.x + area.width - cornerSize,
          area.y,
          cornerSize,
          cornerSize,
        ],
        [
          "corner-bottom-left",
          area.x,
          area.y + area.height - cornerSize,
          cornerSize,
          cornerSize,
        ],
        [
          "corner-bottom-right",
          area.x + area.width - cornerSize,
          area.y + area.height - cornerSize,
          cornerSize,
          cornerSize,
        ],

        [
          "side-top",
          area.x + cornerSize,
          area.y,
          area.width - 2 * cornerSize,
          sideThickness,
        ],
        [
          "side-bottom",
          area.x + cornerSize,
          area.y + area.height - sideThickness,
          area.width - 2 * cornerSize,
          sideThickness,
        ],
        [
          "side-left",
          area.x,
          area.y + cornerSize,
          sideThickness,
          area.height - 2 * cornerSize,
        ],
        [
          "side-right",
          area.x + area.width - sideThickness,
          area.y + cornerSize,
          sideThickness,
          area.height - 2 * cornerSize,
        ],
      ] as const;

      zoneConfigs.forEach(([dockPosition, x, y, width, height]) => {
        const zone = document.createElement("div");

        Object.assign(zone.style, {
          position: "absolute",
          left: `${x}px`,
          top: `${blenderWindowHeight - y - height}px`,
          width: `${width}px`,
          height: `${height}px`,
          border: "2px dashed orange",
          boxSizing: "border-box",
          zIndex: "1000",
          opacity: isDragging ? "0.7" : "0",
          pointerEvents: isDragging ? "auto" : "none",
        });

        zone.className = "anchor-zone";
        zone.id = `${dockPosition}-${areaIndex}`;
        zone.dataset.dockPosition = dockPosition;
        zone.dataset.areaIndex = areaIndex.toString();
        fragment.appendChild(zone);
      });
    });

    document.body.appendChild(fragment);
  }

  private calculateToolbarPosition(
    dockPosition: DockPosition,
    area: BlenderArea,
    toolbarElement: HTMLElement,
    blenderWindowHeight: number
  ): ToolbarPosition {
    const toolbarWidth = toolbarElement.offsetWidth;
    const toolbarHeight = toolbarElement.offsetHeight;

    switch (dockPosition) {
      case "corner-top-left":
        return { x: area.x, y: blenderWindowHeight - area.y - toolbarHeight };
      case "corner-top-right":
        return {
          x: area.x + area.width - toolbarWidth,
          y: blenderWindowHeight - area.y - toolbarHeight,
        };
      case "corner-bottom-left":
        return { x: area.x, y: blenderWindowHeight - (area.y + area.height) };
      case "corner-bottom-right":
        return {
          x: area.x + area.width - toolbarWidth,
          y: blenderWindowHeight - (area.y + area.height),
        };
      case "side-top":
        return {
          x: area.x + (area.width - toolbarWidth) / 2,
          y: blenderWindowHeight - area.y - toolbarHeight,
        };
      case "side-bottom":
        return {
          x: area.x + (area.width - toolbarWidth) / 2,
          y: blenderWindowHeight - (area.y + area.height),
        };
      case "side-left":
        return {
          x: area.x,
          y: blenderWindowHeight - area.y - (area.height + toolbarWidth) / 2,
          transform: "rotate(90deg)",
          transformOrigin: "left bottom",
        };
      case "side-right":
        return {
          x: area.x + area.width - toolbarHeight,
          y: blenderWindowHeight - area.y - (area.height + toolbarWidth) / 2,
          transform: "rotate(90deg)",
          transformOrigin: "left bottom",
        };
      default:
        throw new Error(`Invalid dock position: ${dockPosition}`);
    }
  }

  private applyToolbarPosition(
    toolbarElement: HTMLElement,
    position: ToolbarPosition
  ): void {
    toolbarElement.style.left = `${position.x}px`;
    toolbarElement.style.top = `${position.y}px`;
    toolbarElement.style.transform = position.transform || "none";
    toolbarElement.style.transformOrigin =
      position.transformOrigin || "initial";
  }

  private applyToolbarOrientation(
    toolbarElement: HTMLElement,
    dockPosition: DockPosition
  ): void {
    if (dockPosition === "side-left" || dockPosition === "side-right") {
      toolbarElement.classList.add("vertical");
    } else {
      toolbarElement.classList.remove("vertical");
    }
  }

  dockToolbar(
    zone: HTMLElement,
    toolbarElement: HTMLElement,
    layoutData: LayoutData
  ): DockInfo | null {
    const dockPosition = zone.dataset.dockPosition as DockPosition;
    const areaIndex = parseInt(zone.dataset.areaIndex!);

    if (!dockPosition || isNaN(areaIndex)) return null;

    const area = layoutData.areas[areaIndex];

    if (!area) return null;

    const position = this.calculateToolbarPosition(
      dockPosition,
      area,
      toolbarElement,
      layoutData.window.height
    );

    this.applyToolbarPosition(toolbarElement, position);
    this.applyToolbarOrientation(toolbarElement, dockPosition);

    return { dockPosition, areaIndex };
  }

  updateDockedToolbarPosition(
    dockInfo: DockInfo,
    layoutData: LayoutData,
    toolbarElement: HTMLElement
  ): void {
    const area = layoutData.areas[dockInfo.areaIndex];

    if (!area) return;

    const position = this.calculateToolbarPosition(
      dockInfo.dockPosition,
      area,
      toolbarElement,
      layoutData.window.height
    );

    this.applyToolbarPosition(toolbarElement, position);
    this.applyToolbarOrientation(toolbarElement, dockInfo.dockPosition);
  }

  clearAnchorZones(): void {
    const existingZones = document.querySelectorAll(".anchor-zone");

    existingZones.forEach((zone) => zone.remove());
  }
}
export const anchorZonesManager: AnchorZonesManager =
  new AnchorZonesManagerImpl();
