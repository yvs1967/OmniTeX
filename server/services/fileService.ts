import fs from 'fs/promises';
import path from 'path';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || './latex-workspace';

/**
 * Ensures a path is within the workspace directory to prevent directory traversal.
 */
function resolveSafePath(unsafePath: string) {
  const absoluteWorkspace = path.resolve(WORKSPACE_DIR);
  const requestedPath = path.resolve(WORKSPACE_DIR, unsafePath);
  
  if (!requestedPath.startsWith(absoluteWorkspace)) {
    throw new Error('Access denied: Path is outside workspace');
  }
  return requestedPath;
}

export async function getDirectoryTree(dirRelativePath: string = ''): Promise<FileNode[]> {
  const fullPath = resolveSafePath(dirRelativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    // Ignore internal git repository directory
    if (entry.name === '.git') continue;

    const entryRelativePath = path.join(dirRelativePath, entry.name);
    const node: FileNode = {
      name: entry.name,
      path: entryRelativePath,
      type: entry.isDirectory() ? 'directory' : 'file',
    };

    if (entry.isDirectory()) {
      node.children = await getDirectoryTree(entryRelativePath);
    }

    nodes.push(node);
  }
  
  // Sort: directories first, then files alphabetically
  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function readFileContent(fileRelativePath: string): Promise<string> {
  const fullPath = resolveSafePath(fileRelativePath);
  return await fs.readFile(fullPath, 'utf-8');
}

export async function writeFileContent(fileRelativePath: string, content: string): Promise<void> {
  const fullPath = resolveSafePath(fileRelativePath);
  await fs.writeFile(fullPath, content, 'utf-8');
}

export async function createNode(itemRelativePath: string, isFolder: boolean): Promise<void> {
  const fullPath = resolveSafePath(itemRelativePath);
  if (isFolder) {
    await fs.mkdir(fullPath, { recursive: true });
  } else {
    await fs.writeFile(fullPath, '', 'utf-8');
  }
}

export async function deleteNode(itemRelativePath: string): Promise<void> {
  const fullPath = resolveSafePath(itemRelativePath);
  await fs.rm(fullPath, { recursive: true, force: true });
}

export async function renameNode(oldRelativePath: string, newRelativePath: string): Promise<void> {
  const oldPath = resolveSafePath(oldRelativePath);
  const newPath = resolveSafePath(newRelativePath);
  await fs.rename(oldPath, newPath);
}
