<p align="center">
  <img src="https://img.shields.io/badge/⚡-Turbo_Copy_Pro-3b82f6?style=for-the-badge&labelColor=1e293b" alt="Turbo Copy Pro" />
</p>

<h1 align="center">Turbo Copy Pro</h1>

<p align="center">
  <strong>A blazing-fast, multi-source file copy utility with regex pattern matching — built with Electron.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white" />
  <img src="https://img.shields.io/badge/Electron-28-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square" />
</p>

---

## ✨ Features

| Feature | Description |
|---|---|
| 📁 **Multi-Source & Multi-Destination** | Select multiple source and destination folders at once |
| 🔍 **Regex Pattern Matching** | Search files using powerful regex patterns or exact filenames |
| 🔄 **Recursive Copy** | Traverse subdirectories and preserve the original folder structure |
| ✏️ **Rename on Copy** | Rename individual files before copying — inline editing right in the table |
| 📊 **Live Progress Tracking** | Per-file progress bars with real-time status updates |
| 💾 **Saved Folders** | Source and destination folders are remembered between sessions |
| ⚡ **Overwrite Control** | Toggle to skip or overwrite existing files in destinations |
| 🎨 **Modern UI** | Clean, polished interface with smooth animations |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/turbo-copy-pro.git
cd turbo-copy-pro

# Install dependencies
npm install

# Start the app
npm start
```

---

## 📦 Build Portable .exe

```bash
# Package as a standalone Windows executable
npm run pack
```

The output will be in `dist/Turbo Copy Pro-win32-x64/`. Run `Turbo Copy Pro.exe` directly — no installation needed.

---

## 🛠️ How to Use

1. **Add Source Folders** — Click the browse button or select from saved folders in the sidebar
2. **Add Destination Folders** — Choose one or more destinations where files will be copied
3. **Set Search Patterns** — Enter filenames or regex patterns (one per line) to filter files
   ```
   .*              ← all files
   \.pdf$          ← only PDFs
   report_.*\.xlsx ← Excel files starting with "report_"
   ^backup_        ← files starting with "backup_"
   ```
4. **Preview** — Click the Preview button to scan and display matched files
5. **Rename** *(optional)* — Click the pencil icon next to any file to rename it before copying
6. **Copy Selected** — Check the files you want and hit Copy

---

## ⚙️ Options

| Toggle | Description |
|---|---|
| **Recursive Search** | When enabled, scans subfolders and preserves directory structure during copy |
| **Override Existing** | When enabled, overwrites files that already exist in the destination |

---

## 📂 Project Structure

```
turbo-copy-pro/
├── main.js          # Electron main process (file scanning, copying, IPC)
├── preload.js       # Secure bridge between main and renderer
├── renderer.js      # UI logic (table rendering, events, progress)
├── index.html       # App layout and structure
├── styles.css       # Complete styling
├── package.json     # Dependencies and build scripts
└── dist/            # Build output (generated)
```

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  K401
</p>
