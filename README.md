# OmniTex

A modern, web-based LaTeX IDE, Monaco Editor, live PDF compilation, SyncTeX bidirectional reverse search, and built-in GitHub synchronization.

No Electron or desktop installer required—simply clone the repository, install dependencies with Node.js, and run.

---

## Features

- **Monaco LaTeX Editor**: Full syntax highlighting, auto-completion, line numbers, and cursor customization.
- **SyncTeX Reverse Search**: Click any word or sentence in the compiled PDF to automatically locate and place a blinking cursor (`|`) at that exact spot in the LaTeX source.
- **Multi-Engine Compilation**: Supports `pdfLaTeX`, `XeLaTeX`, and `LuaLaTeX` with real-time error reporting and compilation logs.
- **Interactive PDF Preview**: Zoom controls, instant compilation preview, and custom download/export options.
- **Distraction-Free Layout**:
  - Sliding collapsible panels for both the File Explorer and PDF Preview.
  - Dedicated **Focus Mode** to hide both sidebars and write without distractions.
  - Responsive toolbar with icon-only compact mode for small screens.
- **GitHub Integration**:
  - Direct Pull & Push from the web interface.
  - Token-based authentication using GitHub Personal Access Tokens (PAT).
  - Version history with commit logs and branch tracking.
  - Merge conflict detection.

---

## Prerequisites

1. **Git**: Version 2.20 or higher ([Download Git](https://git-scm.com/))
   - Required for cloning the repository, version tracking, and pulling/pushing changes with GitHub.
   - **Verify installation**:
     ```bash
     git --version
     ```
   - **Ubuntu/Debian**:
     ```bash
     sudo apt update && sudo apt install git
     ```
   - **macOS**:
     ```bash
     brew install git
     # or via Xcode Command Line Tools:
     xcode-select --install
     ```
   - **Windows**:
     Download and install from [git-scm.com](https://git-scm.com/download/win).
   - **Configure your global Git author identity** (recommended):
     ```bash
     git config --global user.name "Your Name"
     git config --global user.email "your.email@example.com"
     ```

2. **Node.js**: Version 18.0.0 or higher ([Download Node.js](https://nodejs.org/))
   - Required to run the local server and web interface.
   - **Verify installation**:
     ```bash
     node -v
     npm -v
     ```

3. **LaTeX Distribution** (installed locally on your machine):
   - Required for compiling `.tex` documents into PDF.
   - **Ubuntu/Debian**:
     ```bash
     sudo apt update && sudo apt install texlive-latex-base texlive-latex-extra texlive-fonts-recommended
     ```
   - **macOS**:
     ```bash
     brew install --cask mactex
     # or lightweight version:
     brew install --cask basictex
     ```
   - **Windows**:
     Install [MiKTeX](https://miktex.org/) or [TeX Live](https://www.tug.org/texlive/).

---

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/your-username/omnitex.git
cd omnitex
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the development server
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## Production Build

To build the optimized client bundle and server for production:

```bash
npm run build
npm start
```

---

## Setting Up GitHub for Push & Pull

You can synchronize your LaTeX projects directly with any GitHub repository (public or private).

### Step 1: Generate a GitHub Personal Access Token (PAT)
Since GitHub discontinued password authentication for Git operations, a Personal Access Token (or SSH) is required:

1. Go to [GitHub Settings -> Developer Settings -> Personal access tokens -> Tokens (classic)](https://github.com/settings/tokens).
2. Click **Generate new token** -> **Generate new token (classic)**.
3. Give it a descriptive Note (e.g. `OmniTex`).
4. Set an Expiration period (e.g. `90 days` or `No expiration`).
5. Under **Select scopes**, check the **`repo`** checkbox (Full control of private repositories).
6. Click **Generate token** at the bottom of the page.
7. **Copy your token immediately** (it starts with `ghp_`).

### Step 2: Configure in OmniTex
1. Open the app at `http://localhost:3000`.
2. Click the **Git Settings (gear icon)** in the top right header.
3. Fill in the fields:
   - **Repository URL**: Your target GitHub repo URL (e.g., `https://github.com/your-username/my-latex-project`).
   - **Personal Access Token (PAT)**: Paste your `ghp_...` token.
   - **Branch**: Target branch (default is `main`).
   - **Author Name**: Your name (used for git commit authoring).
   - **Author Email**: Your email.
4. Click **Save & Connect**.
   - A green status dot and the active branch name will appear in the top navbar.

### Step 3: Pulling Changes from GitHub
- Click the **Pull (download cloud)** button in the top navbar.
- The IDE will fetch the latest commits from the remote repository and fast-forward your workspace files.
- If there are conflicts, a notification will display the conflicted files so you can inspect them.

### Step 4: Pushing Changes to GitHub
- Click the **Push (upload cloud)** button in the top navbar.
- A modal dialog will appear asking for a **Commit Message** (e.g., `"Add Section 3 and bibliography"`).
- Click **Commit & Push**:
  1. All modified, new, and deleted files in `latex-workspace/` are automatically staged (`git add .`).
  2. A commit is created with your author identity and message.
  3. The commit is pushed to your remote branch (`git push origin main`).
- A confirmation banner will notify you once the push successfully finishes.

### Alternative: Direct Command-Line Git Sync
All LaTeX files are stored in the local `latex-workspace/` directory, which is a standard Git repository. You can also run git commands directly in terminal:
```bash
cd latex-workspace
git status
git pull origin main
git add .
git commit -m "Update paper"
git push origin main
```

---

## Project Structure

```
├── server/
│   ├── api/
│   │   ├── compiler.ts       # LaTeX compilation endpoints
│   │   ├── fs.ts             # Workspace filesystem endpoints
│   │   └── git.ts            # Git & GitHub sync endpoints
│   └── services/
│       ├── fileService.ts    # File CRUD & upload handlers
│       ├── gitService.ts     # simple-git Git/GitHub wrapper
│       └── latexService.ts   # CLI latex compiler process runner
├── src/
│   ├── components/
│   │   ├── editor/           # Monaco Editor & image/pdf viewers
│   │   ├── preview/          # PDF previewer with SyncTeX reverse search
│   │   ├── sidebar/          # File outline explorer
│   │   ├── history/          # Git commit history panel
│   │   └── GitControls.tsx   # Top navbar GitHub push/pull controls
│   ├── App.tsx               # Main layout with resizable panels & focus mode
│   └── main.tsx              # React application entry point
├── latex-workspace/          # Default directory where .tex files reside
├── server.ts                 # Express backend mounting Vite middleware
└── vite.config.ts            # Vite build configuration
```

---

## Contributors & Credits

- **Designed and Built by**: [Venkata Subbaiah](https://yvs1967.github.io) (Using AI Studio)

---

## License

MIT
