export type DockPosition =
  | "corner-top-left"
  | "corner-top-right"
  | "corner-bottom-left"
  | "corner-bottom-right"
  | "side-top"
  | "side-bottom"
  | "side-left"
  | "side-right";
export interface DragOffset {
  x: number;
  y: number;
}

export interface DockInfo {
  dockPosition: DockPosition;
  areaIndex: number;
}

export interface BlenderArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlenderWindow {
  width: number;
  height: number;
  screen: {
    areas: BlenderArea[];
  };
}

export interface BlenderLayout {
  windows: BlenderWindow[];
}

export interface LayoutData {
  window: BlenderWindow;
  areas: BlenderArea[];
}
