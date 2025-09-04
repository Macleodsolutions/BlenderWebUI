import type { DragOffset } from "../types";

export interface DragDropManager {
  initialize: (
    dragHandleElement: HTMLElement,
    toolbarElement: HTMLElement
  ) => void;
  startDrag: (e: MouseEvent) => void;
  drag: (e: MouseEvent) => void;
  endDrag: (e: MouseEvent) => void;
  getDockZone: (x: number, y: number) => HTMLElement | null;
  isDragging: () => boolean;
  onDragStart: (callback: () => void) => void;
  onDragEnd: (callback: (dockZone: HTMLElement | null) => void) => void;
}

class DragDropManagerImpl implements DragDropManager {
  private state = {
    isDragging: false,
    dragOffset: { x: 0, y: 0 } as DragOffset,
    elements: {
      handle: null as HTMLElement | null,
      toolbar: null as HTMLElement | null,
    },
    callbacks: {
      start: null as (() => void) | null,
      end: null as ((dockZone: HTMLElement | null) => void) | null,
    },
  };

  private handlers = {
    startDrag: this.startDrag.bind(this),
    drag: this.drag.bind(this),
    endDrag: this.endDrag.bind(this),
  };

  private updateAnchorZones(
    visible: boolean,
    highlightZone?: HTMLElement | null
  ): void {
    document.querySelectorAll<HTMLElement>(".anchor-zone").forEach((zone) => {
      Object.assign(zone.style, {
        opacity: visible ? "0.7" : "0",
        pointerEvents: visible ? "auto" : "none",
        borderColor: zone === highlightZone ? "lime" : "orange",
      });
    });
  }

  initialize(
    dragHandleElement: HTMLElement,
    toolbarElement: HTMLElement
  ): void {
    Object.assign(this.state.elements, {
      handle: dragHandleElement,
      toolbar: toolbarElement,
    });
    dragHandleElement.addEventListener("mousedown", this.handlers.startDrag);
    document.addEventListener("mousemove", this.handlers.drag);
    document.addEventListener("mouseup", this.handlers.endDrag);
  }

  startDrag(e: MouseEvent): void {
    const { toolbar } = this.state.elements;

    if (!toolbar) return;
    this.state.isDragging = true;
    toolbar.classList.add("dragging");
    this.updateAnchorZones(true);
    const rect = toolbar.getBoundingClientRect();

    this.state.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
    this.state.callbacks.start?.();
  }

  drag(e: MouseEvent): void {
    const { toolbar } = this.state.elements;

    if (!this.state.isDragging || !toolbar) return;
    const { x: offsetX, y: offsetY } = this.state.dragOffset;

    toolbar.className = "toolbar clickable-area dragging";
    Object.assign(toolbar.style, {
      position: "absolute",
      left: `${e.clientX - offsetX}px`,
      top: `${e.clientY - offsetY}px`,
      right: "auto",
      bottom: "auto",
      transform: "none",
    });
    this.updateAnchorZones(true, this.getDockZone(e.clientX, e.clientY));
  }

  endDrag(e: MouseEvent): void {
    const { toolbar } = this.state.elements;

    if (!this.state.isDragging || !toolbar) return;
    this.state.isDragging = false;
    toolbar.classList.remove("dragging");
    this.updateAnchorZones(false);
    this.state.callbacks.end?.(this.getDockZone(e.clientX, e.clientY));
  }

  getDockZone(x: number, y: number): HTMLElement | null {
    return (
      Array.from(document.querySelectorAll<HTMLElement>(".anchor-zone")).find(
        (zone) => {
          const rect = zone.getBoundingClientRect();

          return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
          );
        }
      ) || null
    );
  }

  isDragging(): boolean {
    return this.state.isDragging;
  }

  onDragStart(callback: () => void): void {
    this.state.callbacks.start = callback;
  }

  onDragEnd(callback: (dockZone: HTMLElement | null) => void): void {
    this.state.callbacks.end = callback;
  }
}
export const dragDropManager: DragDropManager = new DragDropManagerImpl();
