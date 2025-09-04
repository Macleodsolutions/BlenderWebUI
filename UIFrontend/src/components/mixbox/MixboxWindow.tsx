import React, { useState } from "react";
import "./MixboxWindow.css";

interface MixboxWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

const MixboxWindow: React.FC<MixboxWindowProps> = ({ isOpen, onClose }) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) return null;

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if ((e.target as HTMLElement).classList.contains("mixbox-close-btn"))
      return;
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      setPosition({ x: e.clientX - startX, y: e.clientY - startY });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const windowStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
  } as const;

  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  };

  return (
    <div
      className={`mixbox-window clickable-area ${
        isMinimized ? "minimized" : ""
      }`}
      style={windowStyle}
    >
      <div
        className="mixbox-header clickable-area"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="mixbox-drag-area">⋮⋮</div>
        <h2>Mixbox Painter</h2>
        <div className="mixbox-header-buttons">
          <button
            className="mixbox-minimize-btn clickable-area"
            onClick={toggleMinimize}
            title={isMinimized ? "Restore" : "Minimize"}
          >
            {isMinimized ? "▲" : "_"}
          </button>
          <button className="mixbox-close-btn clickable-area" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className={`mixbox-content ${isMinimized ? "hidden" : ""}`}>
        <iframe
          src="https://scrtwpns.com/mixbox/painter/"
          className="mixbox-iframe"
          title="Mixbox Painter"
          frameBorder="0"
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default MixboxWindow;
