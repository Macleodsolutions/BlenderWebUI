import React, { useState, useEffect, useRef } from "react";
import "./ProductCatalogWindow.css";
import { webViewCommunication } from "../WebViewCommunication";

type ParameterValue = string | number | boolean;
interface BlenderScript {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  version: string;
  scriptPath: string;
  videoId: string;
  tags: string[];
  parameters?: Record<string, ParameterValue>;
}
interface ScriptCatalogWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProductCatalogWindow: React.FC<ScriptCatalogWindowProps> = ({
  isOpen,
  onClose,
}) => {
  const [scripts, setScripts] = useState<BlenderScript[]>([]);
  const [filteredScripts, setFilteredScripts] = useState<BlenderScript[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [selectedScript, setSelectedScript] = useState<BlenderScript | null>(
    null
  );
  const [scriptContent, setScriptContent] = useState<string>("");
  const [isParameterWindowOpen, setIsParameterWindowOpen] = useState(false);
  const [scriptParameters, setScriptParameters] = useState<
    Record<string, ParameterValue>
  >({});
  const mockScripts: BlenderScript[] = [
    {
      id: "1",
      name: "Auto UV Unwrap",
      description:
        "Automatically unwraps UV coordinates for selected objects with smart projection",
      category: "modeling",
      author: "BlenderBot",
      version: "1.2.0",
      scriptPath: "auto_uv_unwrap.py",
      videoId: "JmCIgJxKg8Y",
      tags: ["uv", "unwrap", "modeling", "automation"],
    },
    {
      id: "2",
      name: "Batch Render Setup",
      description:
        "Sets up batch rendering for multiple camera angles with custom naming",
      category: "rendering",
      author: "RenderMaster",
      version: "2.1.0",
      scriptPath: "batch_render.py",
      videoId: "ZTxBrjN1ugA",
      tags: ["render", "batch", "camera", "automation"],
    },
    {
      id: "3",
      name: "Procedural Tree Generator",
      description:
        "Generates realistic trees with customizable parameters using geometry nodes",
      category: "generation",
      author: "NatureGen",
      version: "1.5.2",
      scriptPath: "tree_generator.py",
      videoId: "DEgzuMmJtu8",
      tags: ["tree", "procedural", "nature", "geometry"],
    },
    {
      id: "4",
      name: "Material Library Importer",
      description:
        "Imports and organizes materials from external libraries with preview generation",
      category: "materials",
      author: "MatLib",
      version: "1.0.3",
      scriptPath: "material_importer.py",
      videoId: "V3wghbZ-Vh4",
      tags: ["materials", "import", "library", "organization"],
    },
    {
      id: "5",
      name: "Animation Curve Optimizer",
      description:
        "Optimizes animation curves by removing redundant keyframes and smoothing",
      category: "animation",
      author: "AnimTools",
      version: "1.8.1",
      scriptPath: "curve_optimizer.py",
      videoId: "yjjLD3h3yRc",
      tags: ["animation", "curves", "optimization", "keyframes"],
    },
    {
      id: "6",
      name: "Lighting Studio Setup",
      description:
        "Creates professional studio lighting setups with HDRI and area lights",
      category: "lighting",
      author: "StudioPro",
      version: "2.0.0",
      scriptPath: "studio_lighting.py",
      videoId: "Ys4793edotw",
      tags: ["lighting", "studio", "hdri", "professional"],
    },
    {
      id: "7",
      name: "Mesh Cleanup Tool",
      description:
        "Removes doubles, fixes normals, and optimizes mesh topology automatically",
      category: "modeling",
      author: "CleanMesh",
      version: "1.3.0",
      scriptPath: "mesh_cleanup.py",
      videoId: "R1isb0x4zYw",
      tags: ["mesh", "cleanup", "optimization", "topology"],
    },
    {
      id: "8",
      name: "Export Manager",
      description:
        "Batch exports objects to multiple formats with custom settings per format",
      category: "utility",
      author: "ExportPro",
      version: "1.4.2",
      scriptPath: "export_manager.py",
      videoId: "XqX5wh4YeRw",
      tags: ["export", "batch", "formats", "utility"],
    },
    {
      id: "9",
      name: "Image Resizer",
      description:
        "Resize all images in the Blender scene to a target resolution with options to maintain aspect ratio.",
      category: "utility",
      author: "ImageUtils",
      version: "1.0.0",
      scriptPath: "image_resizer.py",
      videoId: "PPu0yVY9kxY",
      tags: ["images", "optimization", "utility", "batch"],
      parameters: {
        target_width: 1024,
        target_height: 1024,
        maintain_aspect_ratio: true,
      },
    },
  ];
  const mockScriptsRef = useRef<BlenderScript[]>(mockScripts);

  const categories = [
    "all",
    "modeling",
    "rendering",
    "generation",
    "materials",
    "animation",
    "lighting",
    "utility",
  ];

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const timer = setTimeout(() => {
      setScripts(mockScriptsRef.current);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const searchLower = searchTerm.toLowerCase();
    const filtered = scripts.filter((script) => {
      const categoryMatch =
        selectedCategory === "all" || script.category === selectedCategory;
      const searchMatch =
        !searchTerm ||
        [script.name, script.description, script.author, ...script.tags].some(
          (field) => field.toLowerCase().includes(searchLower)
        );

      return categoryMatch && searchMatch;
    });

    setFilteredScripts(filtered);
  }, [scripts, searchTerm, selectedCategory]);

  const loadScriptContent = async (scriptPath: string): Promise<string> => {
    const response = await fetch(`./scripts/${scriptPath}`);

    if (!response.ok)
      throw new Error(`Failed to load script: ${response.statusText}`);

    return response.text();
  };

  const sendScriptToBlender = (
    scriptContent: string,
    script: BlenderScript,
    params: Record<string, ParameterValue> = {}
  ) => {
    const scriptData = {
      name: script.name,
      content: scriptContent,
      timestamp: Date.now(),
      parameters: params,
    };
    const ipcMessage = `SCRIPT_LOAD:${JSON.stringify(scriptData)}`;

    webViewCommunication.sendMessage(ipcMessage);
  };

  const handleScriptClick = async (script: BlenderScript) => {
    try {
      const scriptContent = await loadScriptContent(script.scriptPath);

      setSelectedScript(script);
      setScriptContent(scriptContent);
      setScriptParameters(script.parameters || {});
      setIsParameterWindowOpen(true);
    } catch {
      return;
    }
  };

  const handleParameterChange = (paramName: string, value: ParameterValue) => {
    setScriptParameters((prev) => ({ ...prev, [paramName]: value }));
  };

  const handleSendToBlender = () => {
    if (selectedScript) {
      sendScriptToBlender(scriptContent, selectedScript, scriptParameters);
      setIsParameterWindowOpen(false);
      onClose();
    }
  };

  const handleCloseParameterWindow = () => {
    setIsParameterWindowOpen(false);
    setSelectedScript(null);
    setScriptContent("");
    setScriptParameters({});
  };

  if (!isOpen) return null;

  const renderParameterModal = () => {
    if (!isParameterWindowOpen || !selectedScript) return null;

    return (
      <div className="clickable-area parameter-modal-overlay">
        <div className="clickable-area parameter-modal-content">
          <div className="parameter-modal-header">
            <h2 className="parameter-modal-title">
              {selectedScript.name} Parameters
            </h2>
            <button
              onClick={handleCloseParameterWindow}
              className="parameter-modal-close"
            >
              ×
            </button>
          </div>
          <div className="parameter-modal-body">
            {Object.entries(scriptParameters).length > 0 ? (
              <div className="parameter-form">
                {Object.entries(scriptParameters).map(
                  ([paramName, paramValue]) => (
                    <div key={paramName} className="parameter-field">
                      <label>{paramName}</label>
                      {typeof paramValue === "boolean" ? (
                        <input
                          type="checkbox"
                          checked={paramValue}
                          onChange={(e) =>
                            handleParameterChange(paramName, e.target.checked)
                          }
                          className="parameter-checkbox"
                        />
                      ) : typeof paramValue === "number" ? (
                        <input
                          type="number"
                          value={paramValue}
                          onChange={(e) =>
                            handleParameterChange(
                              paramName,
                              Number(e.target.value)
                            )
                          }
                          className="parameter-input"
                        />
                      ) : (
                        <input
                          type="text"
                          value={paramValue}
                          onChange={(e) =>
                            handleParameterChange(paramName, e.target.value)
                          }
                          className="parameter-input"
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="parameter-empty">
                No parameters available for this script.
              </p>
            )}
          </div>
          <div className="parameter-modal-footer">
            <button
              onClick={handleCloseParameterWindow}
              className="parameter-cancel-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleSendToBlender}
              className="parameter-send-btn"
            >
              Send to Blender
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="product-catalog-overlay clickable-area">
        <div className="product-catalog-window clickable-area">
          <div className="catalog-header">
            <h2>Blender Script Catalog</h2>
            <button className="close-button clickable-area" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="catalog-controls">
            <div className="search-section">
              <input
                type="text"
                placeholder="Search scripts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input clickable-area"
              />
            </div>

            <div className="category-section">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-select clickable-area"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="catalog-content">
            {loading ? (
              <div className="loading">Loading scripts...</div>
            ) : (
              <div className="products-grid">
                {filteredScripts.map((script) => (
                  <div
                    key={script.id}
                    className="product-card clickable-area"
                    onClick={() => handleScriptClick(script)}
                  >
                    <div className="product-thumbnail">
                      <div className="video-preview">
                        <img
                          src={`https://img.youtube.com/vi/${script.videoId}/maxresdefault.jpg`}
                          alt={script.name}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;

                            target.src = `https://img.youtube.com/vi/${script.videoId}/mqdefault.jpg`;
                          }}
                        />
                        <div className="play-button">
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="white"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="product-info">
                      <h3 className="product-name">{script.name}</h3>
                      <p className="product-description">
                        {script.description}
                      </p>
                      <div className="script-metadata">
                        <div className="script-author">by {script.author}</div>
                        <div className="script-version">v{script.version}</div>
                      </div>
                      <div className="product-tags">
                        {script.tags.map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && filteredScripts.length === 0 && (
              <div className="no-products">
                No scripts found matching your criteria.
              </div>
            )}
          </div>
        </div>
      </div>
      {renderParameterModal()}
    </>
  );
};

export default ProductCatalogWindow;
