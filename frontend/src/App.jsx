import { useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import "./App.css";

const API = "https://scancraftbackend.onrender.com";

const filters = [
  { name: "Original", value: "original", icon: "◉" },
  { name: "Natural", value: "natural", icon: "☀" },
  { name: "Enhanced", value: "enhanced", icon: "✦" },
  { name: "Grayscale", value: "grayscale", icon: "◐" },
  { name: "B&W", value: "bw", icon: "◑" },
];

export default function App() {
  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [filter, setFilter] = useState("original");
  const [lines, setLines] = useState([]);
  const [language, setLanguage] = useState("eng");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Upload a document to get started.");
  const [activeTab, setActiveTab] = useState("edit");
  const [showBoxes, setShowBoxes] = useState(true);
  const imageRef = useRef(null);
  const fileInput = useRef(null);

  function uploadDocument(selected) {
    if (!selected) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setStatus("Please upload a JPG, PNG or WEBP image.");
      return;
    }

    if (selected.size > 15 * 1024 * 1024) {
      setStatus("File is too large. Maximum size is 15 MB.");
      return;
    }

    const url = URL.createObjectURL(selected);
    setFile(selected);
    setOriginalUrl(url);
    setImageUrl(url);
    setFilter("original");
    setLines([]);
    setStatus("Document uploaded successfully.");
  }

 async function applyFilter(value) {
  if (!file) {
    setStatus("Please upload a document first.");
    return;
  }

  if (busy) return;

  if (value === "original") {
    setImageUrl(originalUrl);
    setFilter("original");
    setStatus("Original image restored.");
    return;
  }

  setBusy(true);
  setStatus(`Applying ${value} filter...`);

  try {
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("mode", value);

    const response = await fetch(`${API}/process`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let message = `Server error ${response.status}`;

      try {
        const errorData = await response.json();
        message = errorData.detail || message;
      } catch {}

      throw new Error(message);
    }

    const blob = await response.blob();

    if (!blob.size || !blob.type.includes("image")) {
      throw new Error("Server returned an invalid image.");
    }

    const newUrl = URL.createObjectURL(blob);

    setImageUrl(previousUrl => {
      if (previousUrl && previousUrl !== originalUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return newUrl;
    });

    setFilter(value);
    setStatus(`${value} filter applied successfully.`);
  } catch (error) {
    console.error("Filter error:", error);
    setStatus(`Filter failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

  async function recogniseText() {
    if (!imageUrl) {
      setStatus("Upload a document first.");
      return;
    }

    setBusy(true);
    setStatus("Starting text recognition...");

    let worker;

    try {
      worker = await createWorker(language, 1, {
        logger: message => {
          if (message.status === "recognizing text") {
            setStatus(`Recognising text: ${Math.round((message.progress || 0) * 100)}%`);
          } else if (message.status === "loading language traineddata") {
            setStatus("Downloading language data. First use may take a little longer...");
          }
        },
      });

      const result = await worker.recognize(imageUrl);
      const found = (result.data.lines || [])
        .filter(line => line.text && line.text.trim())
        .map((line, index) => ({
          id: index,
          text: line.text.trim(),
          x0: line.bbox.x0,
          y0: line.bbox.y0,
          x1: line.bbox.x1,
          y1: line.bbox.y1,
        }));

      setLines(found);
      setActiveTab("edit");
      setStatus(
        found.length
          ? `Successfully detected ${found.length} text lines. Select a box to edit.`
          : "No text detected. Try a clearer, well-lit photograph."
      );
    } catch (error) {
      setStatus(`OCR error: ${error.message}`);
    } finally {
      if (worker) await worker.terminate();
      setBusy(false);
    }
  }

  function editLine(id, text) {
    setLines(current =>
      current.map(line => line.id === id ? { ...line, text } : line)
    );
  }

  function downloadOriginal() {
    if (!file) return;
    const link = document.createElement("a");
    link.href = originalUrl;
    link.download = file.name;
    link.click();
  }

  function downloadImage() {
  if (!imageUrl) {
    setStatus("No document available to download.");
    return;
  }

  const image = imageRef.current;

  if (!image || !image.complete || !image.naturalWidth) {
    setStatus("Please wait for the image to finish loading.");
    return;
  }

  // If no OCR edits have been made, download the current image directly.
  if (!lines.length) {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "ScanCraft-document.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus("Document downloaded successfully.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  lines.forEach(line => {
    const x = line.x0;
    const y = line.y0;
    const width = Math.max(1, line.x1 - line.x0);
    const height = Math.max(1, line.y1 - line.y0);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 2, y - 2, width + 4, height + 4);

    ctx.fillStyle = "#111111";
    ctx.textBaseline = "top";
    ctx.font = `${Math.max(10, height * 0.78)}px Arial`;
    ctx.fillText(line.text, x, y, width);
  });

  canvas.toBlob(blob => {
    if (!blob) {
      setStatus("Could not create the download.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ScanCraft-edited.png";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus("Edited document downloaded successfully.");
  }, "image/png");
}

  const hasDocument = Boolean(file);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-icon">S</span>
          <span>ScanCraft<span className="brand-ai"> AI</span></span>
        </a>
        <nav className="top-links">
          <span className="nav-label">DOCUMENT STUDIO</span>
          <span className="online-dot" />
          <span className="nav-status">Local workspace</span>
        </nav>
        <button className="top-upload" onClick={() => fileInput.current?.click()}>
          + New document
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={e => uploadDocument(e.target.files?.[0])}
        />
      </header>

      <main className="main-area">
        <section className="welcome">
          <div>
            <div className="eyebrow"><span /> YOUR SMART DOCUMENT WORKSPACE</div>
            <h1>Your documents,<br /><span>perfected with AI.</span></h1>
            <p>Scan, enhance, recognise and edit your documents in one place.</p>
          </div>
          <div className="welcome-art">
            <div className="art-sheet">
              <div className="art-line long" />
              <div className="art-line" />
              <div className="art-line short" />
              <div className="art-highlight" />
              <div className="art-line long" />
              <div className="art-line short" />
            </div>
            <div className="art-spark">✦</div>
          </div>
        </section>

        {!hasDocument ? (
          <section
            className="upload-card"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              uploadDocument(e.dataTransfer.files?.[0]);
            }}
          >
            <div className="upload-icon">↑</div>
            <h2>Bring your document to life</h2>
            <p>Drag and drop your document here, or browse your device.</p>
            <button className="primary-button" onClick={() => fileInput.current?.click()}>
              Choose an image <span>→</span>
            </button>
            <div className="file-types">
              <span>JPG</span><span>PNG</span><span>WEBP</span>
              <small>Maximum file size: 15 MB</small>
            </div>
          </section>
        ) : (
          <section className="studio">
            <div className="studio-heading">
              <div>
                <div className="eyebrow">WORKSPACE</div>
                <h2>{file.name}</h2>
                <p>{(file.size / 1024 / 1024).toFixed(2)} MB · Image document</p>
              </div>
              <button className="subtle-button" onClick={() => {
                setFile(null);
                setLines([]);
                setImageUrl("");
                setOriginalUrl("");
                setStatus("Upload a document to get started.");
              }}>✕ Close document</button>
            </div>

            <div className="studio-grid">
              <aside className="tools-panel">
                <div className="panel-heading">DOCUMENT TOOLS</div>
                <button className={`tool-tab ${activeTab === "edit" ? "selected" : ""}`}
                  onClick={() => setActiveTab("edit")}>▤ <span>Text editor</span></button>
                <button className={`tool-tab ${activeTab === "filters" ? "selected" : ""}`}
                  onClick={() => setActiveTab("filters")}>◐ <span>Image filters</span></button>
                <button className={`tool-tab ${activeTab === "ocr" ? "selected" : ""}`}
                  onClick={() => setActiveTab("ocr")}>✧ <span>Text recognition</span></button>

                <div className="panel-divider" />

                {activeTab === "filters" && (
                  <>
                    <div className="panel-heading">ENHANCEMENTS</div>
                    <div className="filter-list">
                      {filters.map(item => (
                        <button key={item.value}
                          className={`filter-option ${filter === item.value ? "active" : ""}`}
                          disabled={busy}
                          onClick={() => applyFilter(item.value)}>
                          <span>{item.icon}</span>{item.name}
                          {filter === item.value && <b>✓</b>}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {activeTab === "ocr" && (
                  <>
                    <div className="panel-heading">RECOGNITION SETTINGS</div>
                    <label className="field-label">Document language</label>
                    <select className="language-select" value={language}
                      onChange={e => setLanguage(e.target.value)} disabled={busy}>
                      <option value="eng">English</option>
                      <option value="hin">Hindi</option>
                      <option value="mar">Marathi</option>
                      <option value="eng+hin">English + Hindi</option>
                      <option value="eng+mar">English + Marathi</option>
                    </select>
                    <button className="primary-button full-button" disabled={busy}
                      onClick={recogniseText}>✧ Recognise text</button>
                  </>
                )}

                {activeTab === "edit" && (
                  <>
                    <div className="panel-heading">TEXT EDITING</div>
                    <p className="panel-help">
                      {lines.length
                        ? `${lines.length} recognised lines. Select a text box on the document to edit it.`
                        : "Recognise your document to create editable text boxes."}
                    </p>
                    <button className="primary-button full-button" disabled={busy}
                      onClick={recogniseText}>✧ Extract text</button>
                    <label className="toggle-row">
                      <input type="checkbox" checked={showBoxes}
                        onChange={e => setShowBoxes(e.target.checked)} />
                      Show editable boxes
                    </label>
                  </>
                )}

                <div className="panel-divider" />
                <div className="panel-heading">DOWNLOAD</div>
                <button className="download-option" onClick={downloadOriginal}>↓ <span>Original image</span></button>
                <button className="download-option" onClick={downloadImage}>↓ <span>Current document</span></button>
              </aside>

              <div className="canvas-area">
                <div className="canvas-toolbar">
                  <span>DOCUMENT PREVIEW</span>
                  <div><span className="preview-dot" /> {filter.toUpperCase()}</div>
                </div>
                <div className="document-canvas">
                  <div className="image-wrap">
                    <img ref={imageRef} src={imageUrl} alt="Document preview" />
                    {showBoxes && imageRef.current && lines.map(line => {
                      const width = imageRef.current.naturalWidth;
                      const height = imageRef.current.naturalHeight;
                      if (!width || !height) return null;
                      return (
                        <textarea
                          key={line.id}
                          aria-label={`Edit detected text ${line.id + 1}`}
                          className="ocr-box"
                          value={line.text}
                          onChange={e => editLine(line.id, e.target.value)}
                          style={{
                            left: `${line.x0 / width * 100}%`,
                            top: `${line.y0 / height * 100}%`,
                            width: `${Math.max(2, (line.x1 - line.x0) / width * 100)}%`,
                            height: `${Math.max(2, (line.y1 - line.y0) / height * 100)}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="status-bar">
                  <span className={busy ? "status-loading" : "status-dot"} />
                  {status}
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="page-footer">
          <span>ScanCraft AI</span>
          <span>Simple documents. Smarter workflow.</span>
        </footer>
      </main>
    </div>
  );
}