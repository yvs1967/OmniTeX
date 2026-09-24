import React, { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { Save, CloudCheck, CloudOff, Loader2, Sun, Moon } from 'lucide-react';
import debounce from 'lodash.debounce';
import { cn } from '../../lib/utils';

export const LATEX_COMMANDS = [
  { label: '\\documentclass', insertText: '\\documentclass{${1:article}}', detail: 'Document class definition' },
  { label: '\\usepackage', insertText: '\\usepackage[${1:options}]{${2:package}}', detail: 'Include package' },
  { label: '\\begin', insertText: '\\begin{${1:environment}}\n\t$0\n\\end{${1:environment}}', detail: 'Environment block' },
  { label: '\\section', insertText: '\\section{${1:Section Title}}', detail: 'Section heading' },
  { label: '\\subsection', insertText: '\\subsection{${1:Subsection Title}}', detail: 'Subsection heading' },
  { label: '\\subsubsection', insertText: '\\subsubsection{${1:Level 3 heading}}', detail: 'Level 3 heading' },
  { label: '\\textbf', insertText: '\\textbf{${1:bold text}}', detail: 'Bold' },
  { label: '\\textit', insertText: '\\textit{${1:italic text}}', detail: 'Italic' },
  { label: '\\underline', insertText: '\\underline{${1:underlined}}', detail: 'Underline' },
  { label: '\\emph', insertText: '\\emph{${1:emphasized}}', detail: 'Emphasis' },
  { label: '\\item', insertText: '\\item $0', detail: 'List item' },
  { label: '\\begin{itemize}', insertText: '\\begin{itemize}\n\t\\item $0\n\\end{itemize}', detail: 'Bulleted list' },
  { label: '\\begin{enumerate}', insertText: '\\begin{enumerate}\n\t\\item $0\n\\end{enumerate}', detail: 'Numbered list' },
  { label: '\\begin{description}', insertText: '\\begin{description}\n\t\\item[${1:label}] $0\n\\end{description}', detail: 'Description list' },
  { label: '\\begin{tabular}', insertText: '\\begin{tabular}{${1:l c r}}\n\t$0\n\\end{tabular}', detail: 'Table' },
  { label: '\\begin{figure}', insertText: '\\begin{figure}[${1:ht!}]\n\t\\centering\n\t\\includegraphics[width=${2:0.8}\\textwidth]{${3:image}}\n\t\\caption{${4:Caption}}\n\t\\label{fig:${5:label}}\n\\end{figure}', detail: 'Figure' },
  { label: '\\begin{equation}', insertText: '\\begin{equation}\n\t$0\n\\end{equation}', detail: 'Numbered equation' },
  { label: '\\begin{align}', insertText: '\\begin{align}\n\t${1:left} & = ${2:right} \\\\\n\t$0\n\\end{align}', detail: 'Aligned equations' },
  { label: '\\begin{center}', insertText: '\\begin{center}\n\t$0\n\\end{center}', detail: 'Centered text' },
  { label: '\\label', insertText: '\\label{${1:label}}', detail: 'Reference label' },
  { label: '\\ref', insertText: '\\ref{${1:label}}', detail: 'Reference' },
  { label: '\\cite', insertText: '\\cite{${1:bib_key}}', detail: 'Citation' },
  { label: '\\frac', insertText: '\\frac{${1:num}}{${2:den}}', detail: 'Fraction' },
  { label: '\\sqrt', insertText: '\\sqrt{${1:x}}', detail: 'Square root' },
  { label: '\\sum', insertText: '\\sum_{${1:i=1}}^{${2:n}} $0', detail: 'Summation' },
  { label: '\\int', insertText: '\\int_{${1:a}}^{${2:b}} $0', detail: 'Integral' },
  { label: '\\lim', insertText: '\\lim_{${1:x \\to \\infty}} $0', detail: 'Limit' },
  { label: '\\mathbf', insertText: '\\mathbf{${1:text}}', detail: 'Bold math' },
  { label: '\\mathcal', insertText: '\\mathcal{${1:C}}', detail: 'Calligraphic font' },
  { label: '\\mathbb', insertText: '\\mathbb{${1:R}}', detail: 'Blackboard bold' },
  { label: '\\alpha', insertText: '\\alpha', detail: 'Alpha' },
  { label: '\\beta', insertText: '\\beta', detail: 'Beta' },
  { label: '\\gamma', insertText: '\\gamma', detail: 'Gamma' },
  { label: '\\delta', insertText: '\\delta', detail: 'Delta' },
  { label: '\\epsilon', insertText: '\\epsilon', detail: 'Epsilon' },
  { label: '\\theta', insertText: '\\theta', detail: 'Theta' },
  { label: '\\lambda', insertText: '\\lambda', detail: 'Lambda' },
  { label: '\\mu', insertText: '\\mu', detail: 'Mu' },
  { label: '\\pi', insertText: '\\pi', detail: 'Pi' },
  { label: '\\rho', insertText: '\\rho', detail: 'Rho' },
  { label: '\\sigma', insertText: '\\sigma', detail: 'Sigma' },
  { label: '\\omega', insertText: '\\omega', detail: 'Omega' },
  { label: '\\Delta', insertText: '\\Delta', detail: 'Delta (cap)' },
  { label: '\\Sigma', insertText: '\\Sigma', detail: 'Sigma (cap)' },
  { label: '\\Omega', insertText: '\\Omega', detail: 'Omega (cap)' },
  { label: '\\infty', insertText: '\\infty', detail: 'Infinity' },
  { label: '\\to', insertText: '\\to', detail: 'Arrow' },
  { label: '\\implies', insertText: '\\implies', detail: 'Implies' },
  { label: '\\iff', insertText: '\\iff', detail: 'If and only if' },
  { label: '\\approx', insertText: '\\approx', detail: 'Approximate' },
  { label: '\\neq', insertText: '\\neq', detail: 'Not equal' },
  { label: '\\le', insertText: '\\le', detail: 'Less than or equal' },
  { label: '\\ge', insertText: '\\ge', detail: 'Greater than or equal' },
  { label: '\\pm', insertText: '\\pm', detail: 'Plus/minus' },
  { label: '\\times', insertText: '\\times', detail: 'Multiply' },
  { label: '\\div', insertText: '\\div', detail: 'Divide' },
  { label: '\\maketitle', insertText: '\\maketitle', detail: 'Create title' },
  { label: '\\tableofcontents', insertText: '\\tableofcontents', detail: 'ToC' },
  { label: '\\title', insertText: '\\title{${1:Title}}', detail: 'Document Title' },
  { label: '\\author', insertText: '\\author{${1:Author}}', detail: 'Document Author' },
  { label: '\\date', insertText: '\\date{${1:\\today}}', detail: 'Document Date' },
  { label: '\\appendix', insertText: '\\appendix', detail: 'Start Appendix' },
  { label: '\\bibliography', insertText: '\\bibliography{${1:refs}}', detail: 'Bib entry' },
  { label: '\\bibliographystyle', insertText: '\\bibliographystyle{${1:plain}}', detail: 'Bib style' },
  { label: '\\input', insertText: '\\input{${1:file}}', detail: 'Include file' },
  { label: '\\include', insertText: '\\include{${1:file}}', detail: 'Include file (new page)' },
  { label: '\\clearpage', insertText: '\\clearpage', detail: 'Break page' },
  { label: '\\newpage', insertText: '\\newpage', detail: 'New page' },
  { label: '\\hline', insertText: '\\hline', detail: 'Horizontal Line' },
  { label: '\\vspace', insertText: '\\vspace{${1:1cm}}', detail: 'Vertical Space' },
  { label: '\\hspace', insertText: '\\hspace{${1:1cm}}', detail: 'Horizontal Space' },
];

// Extracted outside the component to prevent re-evaluation on every render
const handleBeforeMount = (monaco: any) => {
  monaco.languages.register({ id: 'latex' });

  monaco.languages.setMonarchTokensProvider('latex', {
    tokenizer: {
      root: [
        [/(%.*)$/, 'comment'],
        [/\\(begin|end)(?=[ \t]*\{)/, 'type'],
        [/\\[a-zA-Z]+/, 'keyword'],
        [/\\[&%$#_{}~^]/, 'keyword'],
        [/\$[^$]*\$/, 'string'],
        [/[\{\}\[\]]/, 'delimiter'],
      ]
    }
  });

  monaco.languages.registerCompletionItemProvider('latex', {
    triggerCharacters: ['\\'],
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });

      if (textUntilPosition.endsWith('\\' + word.word)) {
         range.startColumn -= 1;
      }

      const suggestions = LATEX_COMMANDS.map(cmd => ({
        label: cmd.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: cmd.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: cmd.detail,
        range: range
      }));

      return { suggestions };
    }
  });
};

export interface NavigationTarget {
  text: string;
  word?: string;
  timestamp: number;
}

interface LatexEditorProps {
  filePath: string | null;
  onContentChange?: (content: string) => void;
  navigationTarget?: NavigationTarget | null;
  onTargetMatched?: (lineNumber: number, matchedText: string) => void;
}

export default function LatexEditor({ filePath, onContentChange, navigationTarget, onTargetMatched }: LatexEditorProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'vs-dark' | 'vs'>('vs-dark');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [syncedLine, setSyncedLine] = useState<number | null>(null);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // Synchronize cursor & view when navigationTarget is received from PDF click/selection
  useEffect(() => {
    if (!navigationTarget || (!navigationTarget.text && !navigationTarget.word) || !editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const rawPhrase = (navigationTarget.text || '').trim();
    const rawWord = (navigationTarget.word || '').trim();
    if (!rawPhrase && !rawWord) return;

    // Helper to find best target line and column for cursor placement
    const findTarget = (): { line: number; col: number; wordRange?: any } | null => {
      // Strategy 1: If we have both word and phrase, search for phrase first to get exact sentence context
      if (rawWord && rawPhrase && rawPhrase.length > rawWord.length) {
        // Try exact phrase
        let phraseMatches = model.findMatches(rawPhrase, false, false, false, null, true);
        if (!phraseMatches || phraseMatches.length === 0) {
          // Try flexible whitespace regex for phrase
          const escaped = rawPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
          try {
            phraseMatches = model.findMatches(escaped, false, true, false, null, true);
          } catch (_) {}
        }

        if (phraseMatches && phraseMatches.length > 0) {
          const pRange = phraseMatches[0].range;
          const matchedPhrase = model.getValueInRange(pRange);
          const lowerMatched = matchedPhrase.toLowerCase();
          const lowerWord = rawWord.toLowerCase();
          const wordOffset = lowerMatched.indexOf(lowerWord);

          if (wordOffset !== -1) {
            // Found exact word inside the matched phrase
            const line = pRange.startLineNumber;
            const startCol = pRange.startColumn + wordOffset;
            const endCol = startCol + rawWord.length;
            return {
              line,
              col: endCol, // Right after the word: "Welcome |"
              wordRange: monacoRef.current ? new monacoRef.current.Range(line, startCol, line, endCol) : null
            };
          }
        }
      }

      // Strategy 2: Search for the specific word (e.g. "Welcome")
      const searchWord = rawWord || rawPhrase.split(/\s+/)[0];
      if (searchWord && searchWord.length > 0) {
        // First try whole word match
        let wordMatches = model.findMatches(searchWord, false, false, true, null, true);
        if (!wordMatches || wordMatches.length === 0) {
          wordMatches = model.findMatches(searchWord, false, false, false, null, true);
        }

        if (wordMatches && wordMatches.length > 0) {
          // If multiple occurrences, pick the one with most overlap with rawPhrase
          let best = wordMatches[0];
          if (wordMatches.length > 1 && rawPhrase.length > searchWord.length) {
            const contextWords = rawPhrase.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
            let bestScore = -1;
            for (const m of wordMatches) {
              const lineContent = model.getLineContent(m.range.startLineNumber).toLowerCase();
              let score = 0;
              for (const cw of contextWords) {
                if (lineContent.includes(cw)) score++;
              }
              if (score > bestScore) {
                bestScore = score;
                best = m;
              }
            }
          }
          return {
            line: best.range.endLineNumber,
            col: best.range.endColumn, // Right after the word: "Welcome |"
            wordRange: best.range
          };
        }
      }

      // Strategy 3: Search for phrase or subphrase
      if (rawPhrase) {
        let matches = model.findMatches(rawPhrase, false, false, false, null, true);
        if (matches && matches.length > 0) {
          const firstWordLen = rawPhrase.split(/\s+/)[0]?.length || rawPhrase.length;
          return {
            line: matches[0].range.startLineNumber,
            col: matches[0].range.startColumn + firstWordLen,
            wordRange: matches[0].range
          };
        }

        // Subphrase of first 3-5 words
        const words = rawPhrase.replace(/[\r\n\t]+/g, ' ').split(/\s+/).filter((w: string) => w.length > 1);
        if (words.length >= 2) {
          const sub = words.slice(0, 4).map((w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
          try {
            matches = model.findMatches(sub, false, true, false, null, true);
            if (matches && matches.length > 0) {
              const firstLen = words[0].length;
              return {
                line: matches[0].range.startLineNumber,
                col: matches[0].range.startColumn + firstLen,
                wordRange: matches[0].range
              };
            }
          } catch (_) {}
        }

        // Search distinctive words in phrase
        const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'are', 'was', 'this', 'you', 'your']);
        for (const w of words) {
          if (w.length >= 3 && !stopWords.has(w.toLowerCase())) {
            matches = model.findMatches(w, false, false, true, null, true);
            if (matches && matches.length > 0) {
              return {
                line: matches[0].range.endLineNumber,
                col: matches[0].range.endColumn,
                wordRange: matches[0].range
              };
            }
          }
        }
      }

      return null;
    };

    const target = findTarget();
    if (target) {
      const { line, col, wordRange } = target;

      // 1. Reveal line in center smoothly
      editor.revealPositionInCenter(
        { lineNumber: line, column: col },
        1 /* monaco.editor.ScrollType.Smooth */
      );
      
      // 2. Position the blinking cursor right after the word (e.g. Welcome |)
      editor.setPosition({
        lineNumber: line,
        column: col
      });

      // 3. Clear any range selection block so cursor is a visible blinking pipe |
      editor.setSelection({
        startLineNumber: line,
        startColumn: col,
        endLineNumber: line,
        endColumn: col
      });

      // 4. Force focus on Monaco editor so the cursor blinks immediately!
      editor.focus();
      const dom = editor.getDomNode();
      if (dom) {
        dom.focus();
      }

      setSyncedLine(line);
      onTargetMatched?.(line, rawWord || rawPhrase);

      // 5. Visual pulse line decoration that fades out after 2.5 seconds
      const maxCol = model.getLineMaxColumn(line);
      const decRange = wordRange || (monacoRef.current ? new monacoRef.current.Range(line, 1, line, maxCol) : null);
      
      let decorations: string[] = [];
      if (decRange) {
        decorations = editor.deltaDecorations([], [
          {
            range: decRange,
            options: {
              isWholeLine: true,
              className: 'bg-blue-500/15 border-l-4 border-blue-500',
              inlineClassName: 'bg-yellow-300/35 font-semibold rounded',
              overviewRuler: {
                color: 'rgba(59, 130, 246, 0.9)',
                position: 4
              }
            }
          }
        ]);
      }

      setTimeout(() => {
        if (editorRef.current && decorations.length > 0) {
          editorRef.current.deltaDecorations(decorations, []);
        }
        setSyncedLine(null);
      }, 2500);
    }
  }, [navigationTarget]);

  // Load file content when path changes
  useEffect(() => {
    if (!filePath) {
      setContent('');
      return;
    }

    const loadFile = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/fs/file', {
          params: { path: filePath }
        });
        setContent(response.data);
        setSaveStatus('idle');
      } catch (err) {
        console.error('Failed to load file', err);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath]);

  // Robust debounced save function using useRef so it persists across renders
  const debouncedSave = useRef(
    debounce(async (path: string, text: string) => {
      try {
        await axios.post('/api/fs/file', {
          path: path,
          content: text
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Auto-save failed', err);
        setSaveStatus('error');
      }
    }, 1500)
  ).current;

  // Cleanup pending saves if the component unmounts
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || '';
    setContent(newValue);
    if (onContentChange) onContentChange(newValue);

    if (!filePath) return;

    setSaveStatus('saving');
    debouncedSave(filePath, newValue);
  };

  if (!filePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 text-zinc-400">
        <p className="text-sm">Select a file to begin editing</p>
      </div>
    );
  }

  const isLogFile = filePath?.endsWith('.log');
  const editorLanguage = isLogFile ? 'plaintext' : filePath?.endsWith('.bib') ? 'bibtex' : 'latex';

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden relative">
      <div className="h-10 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 max-w-md truncate">{filePath}</span>
          {isLogFile && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-300">
              Compilation Log
            </span>
          )}
          {syncedLine && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded border border-blue-300 animate-pulse flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              SyncTeX Line {syncedLine}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setTheme(theme === 'vs-dark' ? 'vs' : 'vs-dark')}
            className="p-1 hover:bg-zinc-200 rounded text-zinc-400 transition-colors"
            title="Toggle Theme"
          >
            {theme === 'vs-dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Saving...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1.5 text-green-600">
                <CloudCheck className="w-4 h-4" />
                <span className="text-[10px] font-medium uppercase tracking-wider">Saved locally</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-1.5 text-red-500">
                <CloudOff className="w-4 h-4" />
                <span className="text-[10px] font-medium uppercase tracking-wider">Save failed</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        )}
        <Editor
          height="100%"
          language={editorLanguage}
          theme={theme}
          value={content}
          onChange={handleEditorChange}
          beforeMount={handleBeforeMount}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 16 },
            quickSuggestions: !isLogFile,
            suggestOnTriggerCharacters: !isLogFile,
            cursorBlinking: 'blink',
            cursorStyle: 'line',
            cursorWidth: 3,
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'all',
            renderLineHighlightOnlyWhenFocus: false
          }}
        />
      </div>
    </div>
  );
}