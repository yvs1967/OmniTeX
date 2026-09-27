import React, { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { 
  Save, 
  CloudCheck, 
  CloudOff, 
  Loader2, 
  Sun, 
  Moon,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import debounce from 'lodash.debounce';
import { cn } from '../../lib/utils';
import { analyzeLatexDocument, LatexDiagnostic, LatexQuickFix } from './latexLinter';

export const LATEX_ENVIRONMENTS = [
  { name: 'center', detail: 'Centered text environment' },
  { name: 'flushleft', detail: 'Left-aligned text' },
  { name: 'flushright', detail: 'Right-aligned text' },
  { name: 'itemize', detail: 'Bulleted list (\\item)' },
  { name: 'enumerate', detail: 'Numbered list (\\item)' },
  { name: 'description', detail: 'Description list (\\item[label])' },
  { name: 'equation', detail: 'Numbered single-line equation' },
  { name: 'equation*', detail: 'Unnumbered single-line equation' },
  { name: 'align', detail: 'Numbered multi-line aligned equations' },
  { name: 'align*', detail: 'Unnumbered multi-line aligned equations' },
  { name: 'gather', detail: 'Numbered centered multi-line equations' },
  { name: 'gather*', detail: 'Unnumbered centered multi-line equations' },
  { name: 'multline', detail: 'Multi-line single equation' },
  { name: 'multline*', detail: 'Unnumbered multi-line single equation' },
  { name: 'figure', detail: 'Floating figure environment' },
  { name: 'figure*', detail: 'Two-column floating figure' },
  { name: 'table', detail: 'Floating table environment' },
  { name: 'table*', detail: 'Two-column floating table' },
  { name: 'tabular', detail: 'Tabular data environment' },
  { name: 'matrix', detail: 'Plain matrix without delimiters' },
  { name: 'pmatrix', detail: 'Parenthesized matrix ( )' },
  { name: 'bmatrix', detail: 'Bracketed matrix [ ]' },
  { name: 'Bmatrix', detail: 'Braced matrix { }' },
  { name: 'vmatrix', detail: 'Determinant / vertical bar matrix | |' },
  { name: 'Vmatrix', detail: 'Double vertical bar matrix || ||' },
  { name: 'cases', detail: 'Piecewise cases environment' },
  { name: 'array', detail: 'Math array environment' },
  { name: 'abstract', detail: 'Document abstract' },
  { name: 'quote', detail: 'Short quotation' },
  { name: 'quotation', detail: 'Long quotation with indented paragraphs' },
  { name: 'verbatim', detail: 'Raw preformatted code/text' },
  { name: 'verbatim*', detail: 'Verbatim showing space characters' },
  { name: 'lstlisting', detail: 'Code listing environment' },
  { name: 'minipage', detail: 'Sub-page box container' },
  { name: 'document', detail: 'Main document body' },
  { name: 'proof', detail: 'Mathematical proof environment' },
  { name: 'theorem', detail: 'Mathematical theorem' },
  { name: 'lemma', detail: 'Mathematical lemma' },
  { name: 'corollary', detail: 'Mathematical corollary' },
  { name: 'definition', detail: 'Mathematical definition' },
  { name: 'example', detail: 'Example block' },
  { name: 'remark', detail: 'Remark block' },
  { name: 'frame', detail: 'Beamer presentation slide frame' },
  { name: 'columns', detail: 'Beamer / layout multi-columns' },
  { name: 'column', detail: 'Beamer single column' },
  { name: 'tikzpicture', detail: 'TikZ vector graphics canvas' },
  { name: 'environment', detail: 'Generic environment block' },
];

export const LATEX_PACKAGES = [
  // Math & Science
  { name: 'amsmath', detail: 'AMS mathematical facilities (align, gather, subequations, etc.)' },
  { name: 'amssymb', detail: 'Extended AMS mathematical symbols (\\mathbb, \\therefore, etc.)' },
  { name: 'amsthm', detail: 'Typesetting theorems, proofs, and definitions' },
  { name: 'mathtools', detail: 'Mathematical enhancements to amsmath (\\DeclarePairedDelimiter, etc.)' },
  { name: 'bm', detail: 'Access bold symbols in math mode (\\bm)' },
  { name: 'mathrsfs', detail: 'Ralph Smith Formal Script font (\\mathscr)' },
  { name: 'siunitx', detail: 'Typesetting units, physical quantities, and angles consistently' },
  { name: 'physics', detail: 'Macros for typesetting calculus and physics notation' },
  { name: 'cancel', detail: 'Draw diagonal lines through math symbols to show cancellation' },
  { name: 'derivative', detail: 'Derivatives, differentials, and partial derivatives' },
  { name: 'diffcoeff', detail: 'Differential coefficients typesetting' },
  
  // Graphics & Visuals
  { name: 'graphicx', detail: 'Inclusion of external graphics (PNG, JPG, PDF, EPS)' },
  { name: 'tikz', detail: 'Vector graphics drawing canvas in TeX' },
  { name: 'pgfplots', detail: 'Create normal and logarithmic plots in 2D and 3D' },
  { name: 'xcolor', detail: 'Color extensions with broad color model support' },
  { name: 'color', detail: 'Basic foreground and background color control' },
  { name: 'wrapfig', detail: 'Produces figures which text can be wrapped around' },
  { name: 'subcaption', detail: 'Subfigures and subtables within floating figures/tables' },
  { name: 'caption', detail: 'Customizing captions in floating environments' },
  { name: 'float', detail: 'Improved interface for floating objects (provides [H] placement)' },
  { name: 'tcolorbox', detail: 'Colored and framed text boxes with rounded corners' },
  { name: 'circuitikz', detail: 'Drawing electrical networks and circuits with TikZ' },
  
  // Tables & Layout
  { name: 'booktabs', detail: 'Publication-quality tables (\\toprule, \\midrule, \\bottomrule)' },
  { name: 'array', detail: 'Extending array and tabular environments' },
  { name: 'tabularx', detail: 'Tabulars with adjustable-width columns (X column type)' },
  { name: 'longtable', detail: 'Multi-page tables allowing page breaks within tables' },
  { name: 'multirow', detail: 'Create tabular cells spanning multiple rows' },
  { name: 'multicol', detail: 'Multi-column formatting across the entire page or sections' },
  { name: 'colortbl', detail: 'Add background color to LaTeX tables' },
  { name: 'makecell', detail: 'Common layout in tabular cells (multiline headers & cells)' },

  // Page Geometry & Formatting
  { name: 'geometry', detail: 'Flexible and complete interface to page dimensions and margins' },
  { name: 'fancyhdr', detail: 'Extensive control over headers and footers' },
  { name: 'setspace', detail: 'Set space between lines (\\singlespacing, \\onehalfspacing, \\doublespacing)' },
  { name: 'titlesec', detail: 'Select alternative section titles, fonts, and spacings' },
  { name: 'titling', detail: 'Control over the \\maketitle command and metadata' },
  { name: 'parskip', detail: 'Paragraph separation by vertical space instead of indentation' },
  { name: 'pdflscape', detail: 'Make landscape pages visible as landscape in PDF viewers' },
  { name: 'pdfpages', detail: 'Include external multi-page PDF documents' },

  // Typography & Fonts
  { name: 'microtype', detail: 'Subliminal typographic refinements (character protrusion, font expansion)' },
  { name: 'fontspec', detail: 'Advanced font selection for XeLaTeX and LuaLaTeX' },
  { name: 'lmodern', detail: 'Latin Modern vector fonts replacing Computer Modern' },
  { name: 'mathptmx', detail: 'Times font with math support' },
  { name: 'fourier', detail: 'Utopia font with Fourier-GUTenberg math fonts' },
  { name: 'sourcesanspro', detail: 'Source Sans Pro font family' },
  { name: 'sourcecodepro', detail: 'Source Code Pro monospaced font family' },
  { name: 'courier', detail: 'Adobe Courier font' },
  { name: 'soul', detail: 'Hyphenation for letterspacing, underlining, and strikeout' },
  { name: 'ulem', detail: 'Package for underlining, strikethrough (\\sout), and wavy underlines' },

  // Links & Referencing
  { name: 'hyperref', detail: 'Extensive hypertext links and PDF bookmarks' },
  { name: 'cleveref', detail: 'Intelligent cross-referencing (\\cref automatic type detection)' },
  { name: 'url', detail: 'Verbatim with URL-sensitive line breaks' },
  { name: 'bookmark', detail: 'Fast and responsive bookmarks for hyperref' },
  { name: 'nameref', detail: 'Reference sections, figures, etc. by name' },

  // Citations & Bibliographies
  { name: 'biblatex', detail: 'Modern, sophisticated bibliography and citation engine' },
  { name: 'natbib', detail: 'Flexible citation support for author-year & numerical styles' },
  { name: 'cite', detail: 'Improved citation handling for standard numerical citations' },
  { name: 'csquotes', detail: 'Context-sensitive quotation facilities, recommended with biblatex' },

  // Lists & Enumerations
  { name: 'enumitem', detail: 'Control layout of itemize, enumerate, and description lists' },
  { name: 'tasks', detail: 'Horizontally columned lists for exercises and exams' },

  // Code & Algorithms
  { name: 'listings', detail: 'Typeset source code listings with syntax highlighting' },
  { name: 'minted', detail: 'Highlighted source code using Pygments' },
  { name: 'algorithm', detail: 'Algorithm floating wrapper environment' },
  { name: 'algorithmic', detail: 'Algorithm line-by-line formatting' },
  { name: 'algpseudocode', detail: 'Layout for pseudocode algorithms (part of algorithmicx)' },
  { name: 'verbatim', detail: 'Re-implementation of verbatim and comment environments' },

  // Language & Internationalization
  { name: 'babel', detail: 'Multilingual support for document hyphenation and strings' },
  { name: 'polyglossia', detail: 'Modern multilingual package for XeLaTeX and LuaLaTeX' },

  // Utilities & Dummy Content
  { name: 'lipsum', detail: 'Easy dummy text generator (Lorem Ipsum paragraphs)' },
  { name: 'blindtext', detail: 'Generate dummy text, lists, and sections for testing' },
  { name: 'subfiles', detail: 'Manage multi-part documents compiled individually or jointly' },
  { name: 'standalone', detail: 'Compile subfiles independently or combined' },
  { name: 'import', detail: 'Import relative subfiles with relative paths' },
  { name: 'todonotes', detail: 'Marking things to do with margin notes or inline boxes' },
  { name: 'comment', detail: 'Selectively include/exclude multi-line comment blocks' },
];

export const LATEX_DOCUMENT_CLASSES = [
  { name: 'article', detail: 'Scientific articles, papers, and short reports' },
  { name: 'report', detail: 'Reports with several chapters, small books, thesis dissertations' },
  { name: 'book', detail: 'Real books with frontmatter, mainmatter, chapters, and index' },
  { name: 'beamer', detail: 'Presentations, slide decks, and conference talks' },
  { name: 'letter', detail: 'Formal business or personal letters' },
  { name: 'standalone', detail: 'Self-contained elements (TikZ drawings, equations, preview boxes)' },
  { name: 'proc', detail: 'Conference proceedings based on article' },
  { name: 'memoir', detail: 'Comprehensive book and thesis design class' },
  { name: 'scrartcl', detail: 'KOMA-Script article class with European typographic rules' },
  { name: 'scrreprt', detail: 'KOMA-Script report class' },
  { name: 'scrbook', detail: 'KOMA-Script book class' },
  { name: 'extarticle', detail: 'Article supporting additional font sizes (8pt to 20pt)' },
  { name: 'extreport', detail: 'Report supporting additional font sizes' },
  { name: 'extbook', detail: 'Book supporting additional font sizes' },
  { name: 'minimal', detail: 'Minimal class for testing and debugging' },
];

export const LATEX_BIB_STYLES = [
  { name: 'plain', detail: 'Sorted alphabetically, numeric citations [1]' },
  { name: 'unsrt', detail: 'Sorted by order of citation in text, numeric citations [1]' },
  { name: 'alpha', detail: 'Sorted alphabetically, author-year labels [Knu84]' },
  { name: 'abbrv', detail: 'Like plain, with abbreviated author first names and journal titles' },
  { name: 'apalike', detail: 'APA-like author-date citations' },
  { name: 'IEEEtran', detail: 'IEEE Transactions official reference style' },
  { name: 'acm', detail: 'ACM Transactions reference style' },
  { name: 'siam', detail: 'SIAM journal reference style' },
  { name: 'nature', detail: 'Nature journal reference style' },
  { name: 'science', detail: 'Science journal reference style' },
  { name: 'plainnat', detail: 'Natbib plain style supporting both numerical and author-year' },
  { name: 'unsrtnat', detail: 'Natbib unsorted style' },
];

export const LATEX_PAGE_STYLES = [
  { name: 'plain', detail: 'Header empty, page number centered at bottom' },
  { name: 'empty', detail: 'Both header and footer empty' },
  { name: 'headings', detail: 'Header contains current section heading and page number' },
  { name: 'myheadings', detail: 'Custom headers specified by \\markboth or \\markright' },
  { name: 'fancy', detail: 'Fancyhdr customized headers and footers' },
];

export const LATEX_COLORS = [
  { name: 'red', detail: 'Red color' },
  { name: 'blue', detail: 'Blue color' },
  { name: 'green', detail: 'Green color' },
  { name: 'black', detail: 'Black color' },
  { name: 'white', detail: 'White color' },
  { name: 'gray', detail: 'Medium gray' },
  { name: 'darkgray', detail: 'Dark gray' },
  { name: 'lightgray', detail: 'Light gray' },
  { name: 'cyan', detail: 'Cyan color' },
  { name: 'magenta', detail: 'Magenta color' },
  { name: 'yellow', detail: 'Yellow color' },
  { name: 'orange', detail: 'Orange color' },
  { name: 'purple', detail: 'Purple color' },
  { name: 'violet', detail: 'Violet color' },
  { name: 'teal', detail: 'Teal color' },
  { name: 'brown', detail: 'Brown color' },
  { name: 'lime', detail: 'Lime green' },
  { name: 'olive', detail: 'Olive green' },
  { name: 'pink', detail: 'Pink color' },
];

export const LATEX_CLASS_OPTIONS = [
  { name: '10pt', detail: 'Base font size 10pt (default)' },
  { name: '11pt', detail: 'Base font size 11pt' },
  { name: '12pt', detail: 'Base font size 12pt' },
  { name: 'a4paper', detail: 'A4 paper size (210 x 297 mm)' },
  { name: 'letterpaper', detail: 'US Letter paper size (8.5 x 11 in)' },
  { name: 'twocolumn', detail: 'Two-column document layout' },
  { name: 'onecolumn', detail: 'Single column layout (default)' },
  { name: 'titlepage', detail: 'Create separate title page' },
  { name: 'notitlepage', detail: 'Title starts at the top of first page' },
  { name: 'draft', detail: 'Mark overfull boxes with thick black bars' },
  { name: 'final', detail: 'Produce final clean output (default)' },
  { name: 'landscape', detail: 'Orient paper in landscape format' },
  { name: 'oneside', detail: 'One-sided formatting' },
  { name: 'twoside', detail: 'Two-sided formatting for double-sided printing' },
];

export const LATEX_PKG_OPTIONS = [
  { name: 'margin=1in', detail: 'Set page margins to 1 inch (geometry)' },
  { name: 'margin=2cm', detail: 'Set page margins to 2 cm (geometry)' },
  { name: 'top=2cm,bottom=2cm', detail: 'Custom top and bottom margins (geometry)' },
  { name: 'colorlinks=true', detail: 'Color link text instead of boxes (hyperref)' },
  { name: 'hidelinks', detail: 'Remove color and borders from links (hyperref)' },
  { name: 'dvipsnames', detail: 'Load 68 additional standard color names (xcolor)' },
  { name: 'svgnames', detail: 'Load 151 SVG 1.0 color names (xcolor)' },
  { name: 'table', detail: 'Enable table coloring commands (xcolor)' },
  { name: 'utf8', detail: 'UTF-8 input encoding (inputenc)' },
  { name: 'english', detail: 'English language rules (babel)' },
  { name: 'fleqn', detail: 'Left-aligned equations instead of centered' },
];

export const LATEX_GRAPHICS_OPTIONS = [
  { name: 'width=\\textwidth', detail: 'Fit width to full text width' },
  { name: 'width=0.8\\textwidth', detail: 'Fit width to 80% text width' },
  { name: 'width=0.5\\textwidth', detail: 'Fit width to 50% text width' },
  { name: 'width=\\linewidth', detail: 'Fit width to current column/line width' },
  { name: 'scale=0.5', detail: 'Scale image by 50%' },
  { name: 'scale=0.8', detail: 'Scale image by 80%' },
  { name: 'height=5cm', detail: 'Set image height to 5cm' },
  { name: 'keepaspectratio', detail: 'Maintain aspect ratio when width & height set' },
  { name: 'angle=90', detail: 'Rotate image by 90 degrees counterclockwise' },
];

export const LATEX_FLOAT_OPTIONS = [
  { name: 'htbp', detail: 'Here, Top, Bottom, or Page float' },
  { name: 'h!', detail: 'Place float exactly here (strongly insisted)' },
  { name: 'H', detail: 'Place float strictly here (requires float package)' },
  { name: 't', detail: 'Place float at top of page' },
  { name: 'b', detail: 'Place float at bottom of page' },
  { name: 'p', detail: 'Place float on separate page of floats' },
];

export const LATEX_COMMANDS = [
  { label: '\\documentclass', insertText: '\\documentclass{${1:article}}', detail: 'Document class definition' },
  { label: '\\usepackage', insertText: '\\usepackage{${1:package}}', detail: 'Include package' },
  { label: '\\usepackage[options]', insertText: '\\usepackage[${1:options}]{${2:package}}', detail: 'Include package with options' },
  { label: '\\begin', insertText: '\\begin{${1:center}}\n\t$0\n\\end{${1:center}}', detail: 'Environment block' },
  { label: '\\begin{environment}', insertText: '\\begin{${1:center}}\n\t$0\n\\end{${1:center}}', detail: 'Generic environment block' },
  { label: '\\section', insertText: '\\section{${1:Section Title}}', detail: 'Section heading' },
  { label: '\\subsection', insertText: '\\subsection{${1:Subsection Title}}', detail: 'Subsection heading' },
  { label: '\\subsubsection', insertText: '\\subsubsection{${1:Level 3 heading}}', detail: 'Level 3 heading' },
  { label: '\\textbf', insertText: '\\textbf{${1:bold text}}', detail: 'Bold' },
  { label: '\\textit', insertText: '\\textit{${1:italic text}}', detail: 'Italic' },
  { label: '\\underline', insertText: '\\underline{${1:underlined}}', detail: 'Underline' },
  { label: '\\emph', insertText: '\\emph{${1:emphasized}}', detail: 'Emphasis' },
  { label: '\\item', insertText: '\\item $0', detail: 'List item' },
  { label: '\\includegraphics', insertText: '\\includegraphics[width=${1:0.8\\textwidth}]{${2:image}}', detail: 'Include graphics with width' },
  { label: '\\includegraphics{...}', insertText: '\\includegraphics{${1:image}}', detail: 'Include graphics without parameters' },
  { label: '\\includegraphics[scale=...]', insertText: '\\includegraphics[scale=${1:0.5}]{${2:image}}', detail: 'Include scaled graphics' },
  { label: '$$ (display math)', insertText: '$$\n\t$0\n$$', detail: 'Display math block' },
  { label: '$ (inline math)', insertText: '$${1:expression}$$', detail: 'Inline math' },
  { label: '\\begin{itemize}', insertText: '\\begin{itemize}\n\t\\item $0\n\\end{itemize}', detail: 'Bulleted list' },
  { label: '\\begin{enumerate}', insertText: '\\begin{enumerate}\n\t\\item $0\n\\end{enumerate}', detail: 'Numbered list' },
  { label: '\\begin{description}', insertText: '\\begin{description}\n\t\\item[${1:label}] $0\n\\end{description}', detail: 'Description list' },
  { label: '\\begin{tabular}', insertText: '\\begin{tabular}{${1:l c r}}\n\t$0\n\\end{tabular}', detail: 'Table' },
  { label: '\\begin{figure}', insertText: '\\begin{figure}[${1:htbp}]\n\t\\centering\n\t\\includegraphics[width=${2:0.8}\\textwidth]{${3:image}}\n\t\\caption{${4:Caption}}\n\t\\label{fig:${5:label}}\n\\end{figure}', detail: 'Figure' },
  { label: '\\begin{table}', insertText: '\\begin{table}[${1:htbp}]\n\t\\centering\n\t\\begin{tabular}{${2:c c c}}\n\t\t\\hline\n\t\t${3:A} & ${4:B} & ${5:C} \\\\\n\t\t\\hline\n\t\t$0 \\\\\n\t\t\\hline\n\t\\end{tabular}\n\t\\caption{${6:Caption}}\n\t\\label{tab:${7:label}}\n\\end{table}', detail: 'Table environment' },
  { label: '\\begin{equation}', insertText: '\\begin{equation}\n\t$0\n\\end{equation}', detail: 'Numbered equation' },
  { label: '\\begin{align}', insertText: '\\begin{align}\n\t${1:left} &= ${2:right} \\\\\n\t$0\n\\end{align}', detail: 'Aligned equations' },
  { label: '\\begin{center}', insertText: '\\begin{center}\n\t$0\n\\end{center}', detail: 'Centered text' },
  { label: '\\label', insertText: '\\label{${1:label}}', detail: 'Reference label' },
  { label: '\\ref', insertText: '\\ref{${1:label}}', detail: 'Reference' },
  { label: '\\eqref', insertText: '\\eqref{${1:label}}', detail: 'Equation reference' },
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

export interface WorkspaceFileItem {
  path: string;
  name: string;
  isImage: boolean;
  isTex: boolean;
  isBib: boolean;
}

let cachedWorkspaceFiles: WorkspaceFileItem[] = [];
let cachedBibKeys: { key: string; detail?: string }[] = [];
let cachedLabels: string[] = [];

export const fetchWorkspaceFiles = async () => {
  try {
    const res = await axios.get('/api/fs/tree');
    const items: WorkspaceFileItem[] = [];
    const traverse = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        if (n.type === 'file') {
          const lower = n.name.toLowerCase();
          const isImg = /\.(png|jpe?g|pdf|svg|eps|webp|bmp|gif)$/i.test(lower);
          const isTex = /\.tex$/i.test(lower);
          const isBib = /\.bib$/i.test(lower);
          items.push({
            path: n.path,
            name: n.name,
            isImage: isImg,
            isTex: isTex,
            isBib: isBib
          });
        }
        if (n.type === 'directory' && n.children) {
          traverse(n.children);
        }
      }
    };
    traverse(res.data);
    cachedWorkspaceFiles = items;

    // Scan bib files for citation keys
    const bibItems = items.filter(f => f.isBib);
    const discoveredBibKeys: { key: string; detail?: string }[] = [];
    for (const b of bibItems) {
      try {
        const fileRes = await axios.get('/api/fs/file', { params: { path: b.path } });
        if (typeof fileRes.data === 'string') {
          const entries = Array.from(fileRes.data.matchAll(/@\w+\s*\{\s*([a-zA-Z0-9_:.-]+)/g));
          for (const m of entries) {
            const key = (m as any)[1];
            if (!discoveredBibKeys.some(k => k.key === key)) {
              discoveredBibKeys.push({ key, detail: `BibTeX entry in ${b.name}` });
            }
          }
        }
      } catch (_) {}
    }
    cachedBibKeys = discoveredBibKeys;

    // Scan tex files for labels
    const texItems = items.filter(f => f.isTex);
    const discoveredLabels: string[] = [];
    for (const t of texItems) {
      try {
        const fileRes = await axios.get('/api/fs/file', { params: { path: t.path } });
        if (typeof fileRes.data === 'string') {
          const labels = Array.from(fileRes.data.matchAll(/\\label\{([^}]+)\}/g));
          for (const l of labels) {
            const lbl = (l as any)[1].trim();
            if (!discoveredLabels.includes(lbl)) {
              discoveredLabels.push(lbl);
            }
          }
        }
      } catch (_) {}
    }
    cachedLabels = discoveredLabels;
  } catch (_) {}
};

// Initial background fetch
fetchWorkspaceFiles();

// Extracted outside the component to prevent re-evaluation on every render
const handleBeforeMount = (monaco: any) => {
  monaco.languages.register({ id: 'latex' });

  // Language configuration for auto-closing pairs (including $), comments, and brackets
  monaco.languages.setLanguageConfiguration('latex', {
    comments: {
      lineComment: '%',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '$', close: '$' },
      { open: '"', close: '"' },
      { open: '`', close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '$', close: '$' },
      { open: '"', close: '"' },
    ],
    folding: {
      markers: {
        start: new RegExp('^\\s*\\\\begin\\{([a-zA-Z0-9*]+)\\}'),
        end: new RegExp('^\\s*\\\\end\\{([a-zA-Z0-9*]+)\\}')
      }
    }
  });

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
    triggerCharacters: ['\\', '{', '$', '[', '/', ',', '.'],
    provideCompletionItems: (model: any, position: any) => {
      const lineText = model.getLineContent(position.lineNumber);
      const textBefore = lineText.substring(0, position.column - 1);
      const textAfter = lineText.substring(position.column - 1);

      // =========================================================================
      // Case 1: Cursor is inside \begin{...} or \end{...} (or begin{...})
      // ONLY pure environment names are suggested! NEVER \begin{center}\end{center}!
      // =========================================================================
      const envMatch = textBefore.match(/(?:\\)?(begin|end)\{([^}]*)$/);
      if (envMatch) {
        const commandType = envMatch[1]; // 'begin' or 'end'
        const typedPrefix = envMatch[2];
        const afterMatch = textAfter.match(/^([^}]*)(\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPrefix.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const suggestions = LATEX_ENVIRONMENTS.map(env => ({
          label: env.name,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: env.name + (hasClosingBrace ? '' : '}'),
          detail: `${env.detail} (${commandType} environment)`,
          range: range,
          sortText: '0_' + env.name,
          command: {
            id: 'omnitex.onEnvironmentSelected',
            title: 'On Environment Selected',
            arguments: [env.name, commandType]
          }
        }));

        return { suggestions };
      }

      // =========================================================================
      // Case 2: Cursor is inside \usepackage{...} or \usepackage[...]{...} (or usepackage{...})
      // ONLY pure package names are suggested! NEVER \usepackage{\usepackage{pkg}}!
      // =========================================================================
      const pkgMatch = textBefore.match(/(?:\\)?usepackage(?:\s*\[[^\]]*\])?\s*\{([^}]*)$/);
      if (pkgMatch) {
        const inside = pkgMatch[1];
        const lastComma = inside.lastIndexOf(',');
        const currentToken = lastComma === -1 ? inside : inside.substring(lastComma + 1);
        const typedPrefix = currentToken.trimStart();

        const afterMatch = textAfter.match(/^([^,}]*)(,\s*|\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPrefix.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        // Collect packages already in this \usepackage list to prevent duplicates
        const alreadyUsed = inside.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

        const suggestions = LATEX_PACKAGES
          .filter(pkg => !alreadyUsed.includes(pkg.name.toLowerCase()) || pkg.name.toLowerCase() === typedPrefix.toLowerCase())
          .map(pkg => ({
            label: pkg.name,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: pkg.name + (hasClosingBrace ? '' : '}'),
            detail: pkg.detail,
            documentation: `\\usepackage{${pkg.name}}\n\n${pkg.detail}`,
            range: range,
            sortText: '0_' + pkg.name,
          }));

        return { suggestions };
      }

      // =========================================================================
      // Case 3: Cursor is inside \documentclass{...} (or \documentclass[...]{...})
      // ONLY document classes are suggested! NEVER \documentclass{\documentclass{article}}!
      // =========================================================================
      const docClassMatch = textBefore.match(/(?:\\)?documentclass(?:\s*\[[^\]]*\])?\s*\{([^}]*)$/);
      if (docClassMatch) {
        const typedPrefix = docClassMatch[1].trimStart();
        const afterMatch = textAfter.match(/^([^}]*)(\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPrefix.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const suggestions = LATEX_DOCUMENT_CLASSES.map(cls => ({
          label: cls.name,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: cls.name + (hasClosingBrace ? '' : '}'),
          detail: cls.detail,
          documentation: `\\documentclass{${cls.name}}\n\n${cls.detail}`,
          range: range,
          sortText: '0_' + cls.name,
        }));

        return { suggestions };
      }

      // =========================================================================
      // Case 4: Cursor is inside \bibliographystyle{...}
      // ONLY bibliography styles are suggested!
      // =========================================================================
      const bibStyleMatch = textBefore.match(/(?:\\)?bibliographystyle\s*\{([^}]*)$/);
      if (bibStyleMatch) {
        const typedPrefix = bibStyleMatch[1].trimStart();
        const afterMatch = textAfter.match(/^([^}]*)(\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPrefix.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const suggestions = LATEX_BIB_STYLES.map(style => ({
          label: style.name,
          kind: monaco.languages.CompletionItemKind.EnumMember,
          insertText: style.name + (hasClosingBrace ? '' : '}'),
          detail: `Bibliography style (${style.detail})`,
          range: range,
          sortText: '0_' + style.name,
        }));

        return { suggestions };
      }

      // =========================================================================
      // Case 5: Cursor is inside \bibliography{...} or \addbibresource{...}
      // Suggest project .bib files
      // =========================================================================
      const bibMatch = textBefore.match(/(?:\\)?(bibliography|addbibresource)\s*\{([^}]*)$/);
      if (bibMatch) {
        const cmd = bibMatch[1];
        const typedPath = bibMatch[2].trimStart();
        const afterMatch = textAfter.match(/^([^}]*)(\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPath.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const bibFiles = cachedWorkspaceFiles.filter(f => f.isBib);
        const suggestions: any[] = [];

        if (bibFiles.length > 0) {
          bibFiles.forEach(b => {
            const cleanName = cmd === 'bibliography' ? b.path.replace(/\.bib$/, '') : b.path;
            suggestions.push({
              label: b.path,
              kind: monaco.languages.CompletionItemKind.File,
              insertText: cleanName + (hasClosingBrace ? '' : '}'),
              detail: `Bibliography file (${b.name})`,
              range: range,
              sortText: '0_' + b.path,
            });
          });
        } else {
          ['references.bib', 'refs.bib'].forEach(ph => {
            const cleanName = cmd === 'bibliography' ? ph.replace(/\.bib$/, '') : ph;
            suggestions.push({
              label: ph,
              kind: monaco.languages.CompletionItemKind.File,
              insertText: cleanName + (hasClosingBrace ? '' : '}'),
              detail: 'Example bibliography file',
              range: range,
              sortText: '1_' + ph,
            });
          });
        }

        return { suggestions };
      }

      // =========================================================================
      // Case 6: Cursor is inside \cite{...}, \citep{...}, \citet{...}, etc.
      // Suggest real citation keys from active document & workspace .bib files!
      // =========================================================================
      const citeMatch = textBefore.match(/(?:\\)?(cite|citep|citet|citeauthor|citeyear|nocite|footcite|textcite|parencite)(?:\s*\[[^\]]*\])?\s*\{([^}]*)$/);
      if (citeMatch) {
        const inside = citeMatch[2];
        const lastComma = inside.lastIndexOf(',');
        const currentToken = lastComma === -1 ? inside : inside.substring(lastComma + 1);
        const typedPrefix = currentToken.trimStart();

        const afterMatch = textAfter.match(/^([^,}]*)(,\s*|\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPrefix.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const docText = model.getValue();
        const localBibitems = Array.from(docText.matchAll(/\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g)).map((m: any) => ({
          key: m[1].trim(),
          detail: 'Document \\bibitem'
        }));
        const localBibTeX = Array.from(docText.matchAll(/@\w+\s*\{\s*([a-zA-Z0-9_:.-]+)/g)).map((m: any) => ({
          key: m[1].trim(),
          detail: 'Document BibTeX entry'
        }));

        const allCitations = [...cachedBibKeys, ...localBibitems, ...localBibTeX];
        const uniqueKeys = new Map<string, string>();
        allCitations.forEach(c => {
          if (!uniqueKeys.has(c.key)) uniqueKeys.set(c.key, c.detail || 'Citation key');
        });

        const alreadyCited = inside.split(',').map(s => s.trim().toLowerCase());
        const suggestions: any[] = [];

        uniqueKeys.forEach((detail, key) => {
          if (!alreadyCited.includes(key.toLowerCase()) || key.toLowerCase() === typedPrefix.toLowerCase()) {
            suggestions.push({
              label: key,
              kind: monaco.languages.CompletionItemKind.Reference,
              insertText: key + (hasClosingBrace ? '' : '}'),
              detail: detail,
              range: range,
              sortText: '0_' + key,
            });
          }
        });

        if (suggestions.length === 0) {
          ['einstein1905', 'knuth1984', 'lamport94', 'vaswani2017attention'].forEach(ph => {
            suggestions.push({
              label: ph,
              kind: monaco.languages.CompletionItemKind.Reference,
              insertText: ph + (hasClosingBrace ? '' : '}'),
              detail: 'Example bibliography citation key',
              range: range,
              sortText: '1_' + ph,
            });
          });
        }

        return { suggestions };
      }

      // =========================================================================
      // Case 7: Cursor is inside \ref{...}, \eqref{...}, \pageref{...}, \cref{...}
      // Suggest real labels defined in active document & workspace .tex files!
      // =========================================================================
      const refMatch = textBefore.match(/(?:\\)?(ref|eqref|pageref|autoref|cref|Cref)\s*\{([^}]*)$/);
      if (refMatch) {
        const typedPrefix = refMatch[2].trimStart();
        const afterMatch = textAfter.match(/^([^}]*)(\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPrefix.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const docText = model.getValue();
        const localLabels = Array.from(docText.matchAll(/\\label\{([^}]+)\}/g)).map((m: any) => m[1].trim());
        const allLabels = Array.from(new Set([...cachedLabels, ...localLabels]));

        const suggestions: any[] = [];
        allLabels.forEach(lbl => {
          suggestions.push({
            label: lbl,
            kind: monaco.languages.CompletionItemKind.Reference,
            insertText: lbl + (hasClosingBrace ? '' : '}'),
            detail: `Cross-reference to \\label{${lbl}}`,
            range: range,
            sortText: '0_' + lbl,
          });
        });

        if (suggestions.length === 0) {
          ['fig:diagram', 'sec:intro', 'eq:model', 'tab:results'].forEach(ph => {
            suggestions.push({
              label: ph,
              kind: monaco.languages.CompletionItemKind.Reference,
              insertText: ph + (hasClosingBrace ? '' : '}'),
              detail: `Example cross-reference label (define with \\label{${ph}})`,
              range: range,
              sortText: '1_' + ph,
            });
          });
        }

        return { suggestions };
      }

      // =========================================================================
      // Case 8: Cursor is inside \label{...}
      // Suggest standard label prefix conventions!
      // =========================================================================
      const labelMatch = textBefore.match(/(?:\\)?label\s*\{([^}]*)$/);
      if (labelMatch) {
        const typedPrefix = labelMatch[1].trimStart();
        const afterMatch = textAfter.match(/^([^}]*)(\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';

        const startCol = position.column - typedPrefix.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const suggestions = [
          { label: 'fig:', detail: 'Figure label prefix (e.g. fig:architecture)' },
          { label: 'tab:', detail: 'Table label prefix (e.g. tab:results)' },
          { label: 'sec:', detail: 'Section label prefix (e.g. sec:introduction)' },
          { label: 'subsec:', detail: 'Subsection label prefix (e.g. subsec:evaluation)' },
          { label: 'eq:', detail: 'Equation label prefix (e.g. eq:euler)' },
          { label: 'lst:', detail: 'Code listing label prefix (e.g. lst:algorithm)' },
          { label: 'def:', detail: 'Definition label prefix (e.g. def:metric)' },
          { label: 'thm:', detail: 'Theorem label prefix (e.g. thm:convergence)' },
          { label: 'ch:', detail: 'Chapter label prefix (e.g. ch:background)' },
          { label: 'app:', detail: 'Appendix label prefix (e.g. app:proofs)' },
        ].map(p => ({
          label: p.label,
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: p.label,
          detail: p.detail,
          range: range,
          sortText: '0_' + p.label,
        }));

        return { suggestions };
      }

      // =========================================================================
      // Case 9: Cursor is inside \pagestyle{...} or \thispagestyle{...}
      // Suggest page styles!
      // =========================================================================
      const pageStyleMatch = textBefore.match(/(?:\\)?(?:this)?pagestyle\s*\{([^}]*)$/);
      if (pageStyleMatch) {
        const typedPrefix = pageStyleMatch[1].trimStart();
        const afterMatch = textAfter.match(/^([^}]*)(\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPrefix.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const suggestions = LATEX_PAGE_STYLES.map(ps => ({
          label: ps.name,
          kind: monaco.languages.CompletionItemKind.EnumMember,
          insertText: ps.name + (hasClosingBrace ? '' : '}'),
          detail: ps.detail,
          range: range,
          sortText: '0_' + ps.name,
        }));

        return { suggestions };
      }

      // =========================================================================
      // Case 10: Cursor is inside \textcolor{...}, \color{...}, etc.
      // Suggest colors!
      // =========================================================================
      const colorMatch = textBefore.match(/(?:\\)?(?:textcolor|color|pagecolor|colorlet)(?:\s*\[[^\]]*\])?\s*\{([^}]*)$/);
      if (colorMatch) {
        const typedPrefix = colorMatch[1].trimStart();
        const afterMatch = textAfter.match(/^([^}]*)(\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPrefix.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const suggestions = LATEX_COLORS.map(c => ({
          label: c.name,
          kind: monaco.languages.CompletionItemKind.Color,
          insertText: c.name + (hasClosingBrace ? '' : '}'),
          detail: c.detail,
          range: range,
          sortText: '0_' + c.name,
        }));

        return { suggestions };
      }

      // =========================================================================
      // Case 11: Cursor is inside \includegraphics[...]{...} or \includegraphics{...}
      // Suggest all image files in workspace and subfolders!
      // =========================================================================
      const includegraphicsMatch = textBefore.match(/(?:\\)?includegraphics(?:\s*\[[^\]]*\])?\s*\{([^}]*)$/);
      if (includegraphicsMatch) {
        const typedPath = includegraphicsMatch[1].trimStart();
        const afterMatch = textAfter.match(/^([^}]*)(\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPath.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const images = cachedWorkspaceFiles.filter(f => f.isImage);
        const suggestions: any[] = [];

        if (images.length > 0) {
          images.forEach(img => {
            suggestions.push({
              label: img.path,
              kind: monaco.languages.CompletionItemKind.File,
              insertText: img.path + (hasClosingBrace ? '' : '}'),
              detail: `Project image asset (${img.name})`,
              range: range,
              sortText: '0_' + img.path
            });
            if (img.path.includes('/')) {
              suggestions.push({
                label: img.name,
                kind: monaco.languages.CompletionItemKind.File,
                insertText: img.path + (hasClosingBrace ? '' : '}'),
                detail: `Image in folder: ${img.path}`,
                range: range,
                sortText: '1_' + img.name
              });
            }
          });
        } else {
          ['images/sample.png', 'images/diagram.png', 'images/flower.jpg'].forEach(ph => {
            suggestions.push({
              label: ph,
              kind: monaco.languages.CompletionItemKind.File,
              insertText: ph + (hasClosingBrace ? '' : '}'),
              detail: 'Example image path',
              range: range,
              sortText: '2_' + ph
            });
          });
        }

        return { suggestions };
      }

      // =========================================================================
      // Case 12: Cursor is inside \include{...} or \input{...} or \subfile{...}
      // Suggest all .tex files in workspace and subfolders!
      // =========================================================================
      const includeMatch = textBefore.match(/(?:\\)?(include|input|subfile)\s*\{([^}]*)$/);
      if (includeMatch) {
        const command = includeMatch[1];
        const typedPath = includeMatch[2].trimStart();
        const afterMatch = textAfter.match(/^([^}]*)(\}?)/);
        const suffix = afterMatch ? afterMatch[1] : '';
        const hasClosingBrace = textAfter.includes('}');

        const startCol = position.column - typedPath.length;
        const endCol = position.column + suffix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: endCol,
        };

        const texFiles = cachedWorkspaceFiles.filter(f => f.isTex);
        const suggestions: any[] = [];

        texFiles.forEach(tex => {
          const cleanName = command === 'include' ? tex.path.replace(/\.tex$/, '') : tex.path;
          suggestions.push({
            label: tex.path,
            kind: monaco.languages.CompletionItemKind.File,
            insertText: cleanName + (hasClosingBrace ? '' : '}'),
            detail: `LaTeX document file (${tex.name})`,
            range: range,
            sortText: '0_' + tex.path
          });
        });

        return { suggestions };
      }

      // =========================================================================
      // Case 13: Cursor is inside square brackets [...] for options
      // =========================================================================
      const docClassOptMatch = textBefore.match(/(?:\\)?documentclass\s*\[([^\]]*)$/);
      if (docClassOptMatch) {
        const inside = docClassOptMatch[1];
        const lastComma = inside.lastIndexOf(',');
        const currentToken = lastComma === -1 ? inside : inside.substring(lastComma + 1);
        const typedPrefix = currentToken.trimStart();
        const hasClosingBracket = textAfter.includes(']');
        const startCol = position.column - typedPrefix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: position.column,
        };
        const suggestions = LATEX_CLASS_OPTIONS.map(opt => ({
          label: opt.name,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: opt.name + (hasClosingBracket ? '' : ']'),
          detail: opt.detail,
          range: range,
          sortText: '0_' + opt.name,
        }));
        return { suggestions };
      }

      const pkgOptMatch = textBefore.match(/(?:\\)?usepackage\s*\[([^\]]*)$/);
      if (pkgOptMatch) {
        const inside = pkgOptMatch[1];
        const lastComma = inside.lastIndexOf(',');
        const currentToken = lastComma === -1 ? inside : inside.substring(lastComma + 1);
        const typedPrefix = currentToken.trimStart();
        const hasClosingBracket = textAfter.includes(']');
        const startCol = position.column - typedPrefix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: position.column,
        };
        const suggestions = LATEX_PKG_OPTIONS.map(opt => ({
          label: opt.name,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: opt.name + (hasClosingBracket ? '' : ']'),
          detail: opt.detail,
          range: range,
          sortText: '0_' + opt.name,
        }));
        return { suggestions };
      }

      const imgOptMatch = textBefore.match(/(?:\\)?includegraphics\s*\[([^\]]*)$/);
      if (imgOptMatch) {
        const inside = imgOptMatch[1];
        const lastComma = inside.lastIndexOf(',');
        const currentToken = lastComma === -1 ? inside : inside.substring(lastComma + 1);
        const typedPrefix = currentToken.trimStart();
        const hasClosingBracket = textAfter.includes(']');
        const startCol = position.column - typedPrefix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: position.column,
        };
        const suggestions = LATEX_GRAPHICS_OPTIONS.map(opt => ({
          label: opt.name,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: opt.name + (hasClosingBracket ? '' : ']'),
          detail: opt.detail,
          range: range,
          sortText: '0_' + opt.name,
        }));
        return { suggestions };
      }

      const floatOptMatch = textBefore.match(/(?:\\)?begin\{(?:figure|table)\*?\}\s*\[([^\]]*)$/);
      if (floatOptMatch) {
        const typedPrefix = floatOptMatch[1].trimStart();
        const hasClosingBracket = textAfter.includes(']');
        const startCol = position.column - typedPrefix.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: position.column,
        };
        const suggestions = LATEX_FLOAT_OPTIONS.map(opt => ({
          label: opt.name,
          kind: monaco.languages.CompletionItemKind.Value,
          insertText: opt.name + (hasClosingBracket ? '' : ']'),
          detail: opt.detail,
          range: range,
          sortText: '0_' + opt.name,
        }));
        return { suggestions };
      }

      // =========================================================================
      // Case 14: Math triggers ($ or $$)
      // =========================================================================
      if (textBefore.endsWith('$$') || textBefore.endsWith('$')) {
        const isDouble = textBefore.endsWith('$$');
        const startCol = position.column - (isDouble ? 2 : 1);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: position.column,
        };

        const suggestions = [
          {
            label: '$ ... $ (Inline Math)',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '$${1:expression}$$',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Inline math formula with blinking cursor',
            range: range,
            sortText: '0_inline'
          },
          {
            label: '$$ ... $$ (Display Math Block)',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '$$\n\t$0\n$$',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Display math equation block',
            range: range,
            sortText: '1_display'
          }
        ];

        return { suggestions };
      }

      // =========================================================================
      // Case 15: Inside generic {...} of ANY other command (e.g. \textbf{...}, \section{...})
      // NEVER suggest top-level preamble/environment/structure snippets!
      // If user did NOT type '\', return empty suggestions so regular text isn't corrupted!
      // =========================================================================
      let openBraces = 0;
      for (let i = 0; i < textBefore.length; i++) {
        if (textBefore[i] === '{' && (i === 0 || textBefore[i - 1] !== '\\')) openBraces++;
        else if (textBefore[i] === '}' && (i === 0 || textBefore[i - 1] !== '\\')) openBraces--;
      }

      if (openBraces > 0) {
        const word = model.getWordUntilPosition(position);
        // If user is writing plain text without backslash '\', do not pop up commands
        if (!textBefore.endsWith('\\' + word.word)) {
          return { suggestions: [] };
        }

        // User typed '\' inside braces: offer ONLY inline commands, references, citations, and math symbols
        const startCol = position.column - word.word.length - 1;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: startCol,
          endColumn: word.endColumn,
        };

        const inlineCommands = LATEX_COMMANDS.filter(cmd => 
          !cmd.label.startsWith('\\begin') &&
          !cmd.label.startsWith('\\documentclass') &&
          !cmd.label.startsWith('\\usepackage') &&
          !cmd.label.startsWith('\\section') &&
          !cmd.label.startsWith('\\subsection') &&
          !cmd.label.startsWith('\\subsubsection') &&
          !cmd.label.startsWith('\\maketitle') &&
          !cmd.label.startsWith('\\tableofcontents') &&
          !cmd.label.startsWith('\\appendix') &&
          !cmd.label.startsWith('\\include') &&
          !cmd.label.startsWith('\\input')
        );

        const suggestions = inlineCommands.map(cmd => ({
          label: cmd.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: cmd.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: cmd.detail,
          range: range,
          sortText: '0_' + cmd.label
        }));

        return { suggestions };
      }

      // =========================================================================
      // Case 16: General LaTeX commands outside braces
      // =========================================================================
      const word = model.getWordUntilPosition(position);
      let startCol = word.startColumn;

      // Expand start column to include leading backslash if present
      if (textBefore.endsWith('\\' + word.word)) {
        startCol -= 1;
      }

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: startCol,
        endColumn: word.endColumn,
      };

      const suggestions: any[] = LATEX_COMMANDS.map(cmd => ({
        label: cmd.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: cmd.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: cmd.detail,
        range: range,
        sortText: cmd.label.startsWith('\\begin') ? '1_' + cmd.label : '2_' + cmd.label
      }));

      // Dynamically add direct \includegraphics completions for available images
      const images = cachedWorkspaceFiles.filter(f => f.isImage);
      images.forEach(img => {
        suggestions.push({
          label: `\\includegraphics{${img.path}}`,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `\\includegraphics[width=0.8\\textwidth]{${img.path}}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: `Insert image: ${img.path}`,
          range: range,
          sortText: '0_img_' + img.name
        });
      });

      return { suggestions };
    }
  });

  // Code Action Provider for LaTeX error Quick Fixes (lightbulb 💡)
  monaco.languages.registerCodeActionProvider('latex', {
    provideCodeActions: (model: any, range: any, context: any) => {
      const activeDiags = (model as any).__omnitexDiagnostics as LatexDiagnostic[] || [];
      const actions: any[] = [];

      for (const d of activeDiags) {
        if (d.line >= range.startLineNumber && d.line <= range.endLineNumber) {
          if (d.quickFixes) {
            for (const fix of d.quickFixes) {
              actions.push({
                title: `⚡ ${fix.title}`,
                kind: 'quickfix',
                isPreferred: !!fix.isPreferred,
                diagnostics: context.markers,
                edit: {
                  edits: [{
                    resource: model.uri,
                    textEdit: {
                      range: new monaco.Range(
                        fix.range.startLineNumber,
                        fix.range.startColumn,
                        fix.range.endLineNumber,
                        fix.range.endColumn
                      ),
                      text: fix.newText
                    }
                  }]
                }
              });
            }
          }
        }
      }
      return { actions, dispose: () => {} };
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
  const [diagnostics, setDiagnostics] = useState<LatexDiagnostic[]>([]);
  const [showIssues, setShowIssues] = useState(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const runLinter = useRef(
    debounce((text: string) => {
      if (!editorRef.current || !monacoRef.current) return;
      const model = editorRef.current.getModel();
      if (!model) return;

      const isTex = filePath?.endsWith('.tex');
      if (!isTex) {
        monacoRef.current.editor.setModelMarkers(model, 'omnitex-linter', []);
        setDiagnostics([]);
        (model as any).__omnitexDiagnostics = [];
        return;
      }

      const diags = analyzeLatexDocument(text, cachedWorkspaceFiles);
      setDiagnostics(diags);
      (model as any).__omnitexDiagnostics = diags;

      const markers = diags.map(d => ({
        severity: d.severity === 'error'
          ? monacoRef.current.MarkerSeverity.Error
          : d.severity === 'warning'
          ? monacoRef.current.MarkerSeverity.Warning
          : monacoRef.current.MarkerSeverity.Info,
        message: d.message,
        startLineNumber: d.line,
        startColumn: d.startCol,
        endLineNumber: d.line,
        endColumn: d.endCol,
        source: 'LaTeX Linter'
      }));

      monacoRef.current.editor.setModelMarkers(model, 'omnitex-linter', markers);
    }, 200)
  ).current;

  const handleApplyFix = (fix: LatexQuickFix) => {
    if (!editorRef.current || !monacoRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    editorRef.current.executeEdits('apply-linter-fix', [{
      range: new monacoRef.current.Range(
        fix.range.startLineNumber,
        fix.range.startColumn,
        fix.range.endLineNumber,
        fix.range.endColumn
      ),
      text: fix.newText
    }]);

    const updatedText = model.getValue();
    setContent(updatedText);
    if (onContentChange) onContentChange(updatedText);
    if (filePath) {
      setSaveStatus('saving');
      debouncedSave(filePath, updatedText);
    }

    editorRef.current.setPosition({
      lineNumber: fix.range.startLineNumber,
      column: fix.range.startColumn
    });
    editorRef.current.revealLineInCenter(fix.range.startLineNumber);
    editorRef.current.focus();

    setTimeout(() => {
      runLinter(updatedText);
    }, 50);
  };

  const handleJumpToDiagnostic = (diag: LatexDiagnostic) => {
    if (!editorRef.current) return;
    editorRef.current.setPosition({
      lineNumber: diag.line,
      column: diag.startCol
    });
    editorRef.current.revealLineInCenter(diag.line);
    editorRef.current.focus();
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register command executed when an environment is selected from autocomplete
    try {
      monaco.editor.registerCommand('omnitex.onEnvironmentSelected', (_: any, envName: string, commandType: string = 'begin') => {
        setTimeout(() => {
          const model = editor.getModel();
          if (!model) return;
          const pos = editor.getPosition();
          if (!pos) return;

          const curLine = pos.lineNumber;
          const curLineContent = model.getLineContent(curLine);

          if (commandType === 'end') {
            const endIdx = curLineContent.indexOf(`\\end{${envName}}`);
            const endCol = endIdx !== -1 ? endIdx + `\\end{${envName}}`.length + 1 : curLineContent.length + 1;
            editor.setSelections([new monaco.Selection(curLine, endCol, curLine, endCol)]);
            editor.setPosition({ lineNumber: curLine, column: endCol });
            editor.focus();
            return;
          }

          // Command is \begin{envName}
          // Search for corresponding \end{...} in following lines
          let matchingEndLine = -1;
          let anyEndLine = -1;

          for (let l = curLine + 1; l <= Math.min(curLine + 15, model.getLineCount()); l++) {
            const lineText = model.getLineContent(l);
            if (lineText.includes(`\\end{${envName}}`)) {
              matchingEndLine = l;
              break;
            }
            if (lineText.includes('\\end{') && anyEndLine === -1) {
              anyEndLine = l;
            }
          }

          if (matchingEndLine === -1) {
            if (anyEndLine !== -1) {
              const endLineContent = model.getLineContent(anyEndLine);
              const updatedEndLine = endLineContent.replace(/\\end\{[^}]*\}/, `\\end{${envName}}`);
              editor.executeEdits('fix-end-env', [{
                range: new monaco.Range(anyEndLine, 1, anyEndLine, endLineContent.length + 1),
                text: updatedEndLine
              }]);
            } else {
              const indent = curLineContent.match(/^\s*/)?.[0] || '';
              editor.executeEdits('insert-end-env', [{
                range: new monaco.Range(curLine, curLineContent.length + 1, curLine, curLineContent.length + 1),
                text: `\n${indent}\t\n${indent}\\end{${envName}}`
              }]);
            }
          }

          // CRITICAL: Force exactly ONE single cursor blinking inside the environment!
          const targetLine = curLine + 1;
          const targetContent = targetLine <= model.getLineCount() ? model.getLineContent(targetLine) : '';
          const targetCol = targetContent.length + 1;

          // Single selection array explicitly destroys secondary / linked snippet cursors
          editor.setSelections([new monaco.Selection(targetLine, targetCol, targetLine, targetCol)]);
          editor.setPosition({ lineNumber: targetLine, column: targetCol });
          editor.focus();
        }, 30);
      });
    } catch (_) {
      // Command already registered in Monaco runtime
    }

    editor.onKeyDown((e: any) => {
      // =========================================================================
      // 1. Enter key: prevent duplicated typing across \begin and \end multi-cursors
      //    and auto-expand display math ($$|$$)
      // =========================================================================
      if (e.browserEvent.key === 'Enter') {
        const selections = editor.getSelections();
        const model = editor.getModel();
        const pos = editor.getPosition();

        // Check if multi-cursor active (e.g. from snippet or linked selection)
        if (selections && selections.length > 1 && model) {
          const sel1 = selections[0];
          const sel2 = selections[1];
          const line1 = model.getLineContent(sel1.positionLineNumber);
          const line2 = model.getLineContent(sel2.positionLineNumber);

          if (line1.includes('\\begin{') && line2.includes('\\end{')) {
            e.preventDefault();
            e.stopPropagation();

            const targetLine = sel1.positionLineNumber + 1;
            if (targetLine < sel2.positionLineNumber) {
              const targetContent = model.getLineContent(targetLine);
              const col = targetContent.length + 1;
              editor.setSelections([new monaco.Selection(targetLine, col, targetLine, col)]);
              editor.setPosition({ lineNumber: targetLine, column: col });
            } else {
              const indent = line1.match(/^\s*/)?.[0] || '';
              editor.executeEdits('single-enter', [{
                range: new monaco.Range(sel1.positionLineNumber, line1.length + 1, sel1.positionLineNumber, line1.length + 1),
                text: `\n${indent}\t`
              }]);
              editor.setSelections([new monaco.Selection(targetLine, indent.length + 2, targetLine, indent.length + 2)]);
              editor.setPosition({ lineNumber: targetLine, column: indent.length + 2 });
            }
            editor.focus();
            return;
          }
        }

        // Check if cursor is inside $$|$$ (display math) -> expand to block with indented line!
        if (model && pos) {
          const lineContent = model.getLineContent(pos.lineNumber);
          const textBefore = lineContent.substring(0, pos.column - 1);
          const textAfter = lineContent.substring(pos.column - 1);

          if (textBefore.endsWith('$$') && textAfter.startsWith('$$')) {
            e.preventDefault();
            e.stopPropagation();
            const indent = lineContent.match(/^\s*/)?.[0] || '';
            editor.executeEdits('split-display-math', [{
              range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
              text: `\n${indent}\t\n${indent}`
            }]);
            editor.setPosition({
              lineNumber: pos.lineNumber + 1,
              column: indent.length + 2
            });
            editor.setSelection(new monaco.Selection(pos.lineNumber + 1, indent.length + 2, pos.lineNumber + 1, indent.length + 2));
            editor.focus();
            return;
          }

          // Single cursor at end of \begin{env} without \end{env}
          if (selections && selections.length === 1) {
            const trimmed = lineContent.trim();
            const match = trimmed.match(/^\\begin\{([a-zA-Z0-9*]+)\}$/);
            if (match && pos.column >= lineContent.indexOf('}') + 1) {
              const nextLine = pos.lineNumber < model.getLineCount() ? model.getLineContent(pos.lineNumber + 1).trim() : '';
              const envName = match[1];
              if (!nextLine.startsWith(`\\end{${envName}}`)) {
                e.preventDefault();
                e.stopPropagation();
                const indent = lineContent.match(/^\s*/)?.[0] || '';
                editor.executeEdits('auto-end-env', [{
                  range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                  text: `\n${indent}\t\n${indent}\\end{${envName}}`
                }]);
                editor.setPosition({
                  lineNumber: pos.lineNumber + 1,
                  column: indent.length + 2
                });
                editor.setSelection(new monaco.Selection(pos.lineNumber + 1, indent.length + 2, pos.lineNumber + 1, indent.length + 2));
                editor.focus();
                return;
              }
            }
          }
        }
      }

      // =========================================================================
      // 2. Tab key: collapse any multi-cursor inside \begin and \end to single cursor
      // =========================================================================
      if (e.browserEvent.key === 'Tab' || e.browserEvent.key === '}' || e.browserEvent.key === 'Escape') {
        const selections = editor.getSelections();
        if (selections && selections.length > 1) {
          const model = editor.getModel();
          if (model) {
            const sel1 = selections[0];
            const line1 = model.getLineContent(sel1.positionLineNumber);
            if (line1.includes('\\begin{')) {
              e.preventDefault();
              e.stopPropagation();
              const targetLine = sel1.positionLineNumber + 1;
              const targetContent = targetLine <= model.getLineCount() ? model.getLineContent(targetLine) : '';
              const col = targetContent.length + 1;
              editor.setSelections([new monaco.Selection(targetLine, col, targetLine, col)]);
              editor.setPosition({ lineNumber: targetLine, column: col });
              editor.focus();
              return;
            }
          }
        }
      }

      // =========================================================================
      // 3. Backspace & Delete keys: auto-delete empty dollar pair ($$)
      //    Only when no text is in between ($|$)!
      //    If text is between ($iohoh$), the other $ is NOT deleted!
      // =========================================================================
      if (e.browserEvent.key === 'Backspace') {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (model && selection && selection.isEmpty()) {
          const pos = editor.getPosition();
          const lineContent = model.getLineContent(pos.lineNumber);
          const charBefore = pos.column > 1 ? lineContent[pos.column - 2] : '';
          const charAfter = pos.column <= lineContent.length ? lineContent[pos.column - 1] : '';

          // If cursor is between two dollars ($|$) with NO text in between:
          if (charBefore === '$' && charAfter === '$') {
            const charBefore2 = pos.column > 2 ? lineContent[pos.column - 3] : '';
            if (charBefore2 !== '\\') {
              e.preventDefault();
              e.stopPropagation();

              editor.executeEdits('auto-delete-dollar-pair', [{
                range: new monaco.Range(pos.lineNumber, pos.column - 1, pos.lineNumber, pos.column + 1),
                text: ''
              }]);
              editor.setPosition({
                lineNumber: pos.lineNumber,
                column: pos.column - 1
              });
              editor.setSelection(new monaco.Selection(pos.lineNumber, pos.column - 1, pos.lineNumber, pos.column - 1));
              editor.focus();
              return;
            }
          }
        }
      }

      if (e.browserEvent.key === 'Delete') {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (model && selection && selection.isEmpty()) {
          const pos = editor.getPosition();
          const lineContent = model.getLineContent(pos.lineNumber);
          const charBefore = pos.column > 1 ? lineContent[pos.column - 2] : '';
          const charAfter = pos.column <= lineContent.length ? lineContent[pos.column - 1] : '';
          const charAfter2 = pos.column + 1 <= lineContent.length ? lineContent[pos.column] : '';

          // If cursor is right before empty $$ (i.e. |$$) with NO text in between:
          if (charBefore !== '\\' && charAfter === '$' && charAfter2 === '$') {
            e.preventDefault();
            e.stopPropagation();

            editor.executeEdits('auto-delete-dollar-pair-delete', [{
              range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column + 2),
              text: ''
            }]);
            editor.setPosition({
              lineNumber: pos.lineNumber,
              column: pos.column
            });
            editor.setSelection(new monaco.Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column));
            editor.focus();
            return;
          }
        }
      }

      // =========================================================================
      // 4. Dollar ($) key: auto-close pair ($|$) and expand to double dollar ($$|$$)
      //    with blinking cursor right in between!
      // =========================================================================
      if (e.browserEvent.key === '$') {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (!model || !selection) return;

        // If user highlighted text, wrap with $...$
        if (!selection.isEmpty()) {
          e.preventDefault();
          e.stopPropagation();
          const selectedText = model.getValueInRange(selection);
          editor.executeEdits('wrap-dollar', [{
            range: selection,
            text: `$${selectedText}$`
          }]);
          editor.setSelection(new monaco.Selection(
            selection.startLineNumber,
            selection.startColumn + 1,
            selection.endLineNumber,
            selection.endColumn + 1
          ));
          editor.focus();
          return;
        }

        const pos = editor.getPosition();
        const lineContent = model.getLineContent(pos.lineNumber);
        const charBefore = pos.column > 1 ? lineContent[pos.column - 2] : '';
        const charAfter = pos.column <= lineContent.length ? lineContent[pos.column - 1] : '';

        // Case 3a: Cursor is inside `$|$` (cursor between two single dollars):
        // User types second `$` -> convert to `$$|$$` with cursor blinking between them!
        if (charBefore === '$' && charAfter === '$') {
          e.preventDefault();
          e.stopPropagation();

          const charBefore2 = pos.column > 2 ? lineContent[pos.column - 3] : '';
          const charAfter2 = pos.column + 1 <= lineContent.length ? lineContent[pos.column] : '';
          if (charBefore2 === '$' && charAfter2 === '$') {
            // Already inside `$$|$$`, typing $ moves past closing $$
            editor.setPosition({
              lineNumber: pos.lineNumber,
              column: pos.column + 2
            });
            editor.setSelection(new monaco.Selection(pos.lineNumber, pos.column + 2, pos.lineNumber, pos.column + 2));
            editor.focus();
            return;
          }

          // Expand to `$$|$$`
          editor.executeEdits('expand-double-dollar', [{
            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text: '$$'
          }]);
          editor.setPosition({
            lineNumber: pos.lineNumber,
            column: pos.column + 1
          });
          editor.setSelection(new monaco.Selection(pos.lineNumber, pos.column + 1, pos.lineNumber, pos.column + 1));
          editor.focus();
          return;
        }

        // Case 3b: Cursor is right before a closing `$` (e.g. `$x|$`), typing `$` steps over it
        if (charAfter === '$' && charBefore !== '\\') {
          e.preventDefault();
          e.stopPropagation();
          editor.setPosition({
            lineNumber: pos.lineNumber,
            column: pos.column + 1
          });
          editor.setSelection(new monaco.Selection(pos.lineNumber, pos.column + 1, pos.lineNumber, pos.column + 1));
          editor.focus();
          return;
        }

        // Case 3c: Normal typing of `$`:
        // Automatically insert `$$` with cursor blinking right in between: `$|$`
        e.preventDefault();
        e.stopPropagation();
        editor.executeEdits('auto-close-dollar', [{
          range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
          text: '$$'
        }]);
        editor.setPosition({
          lineNumber: pos.lineNumber,
          column: pos.column + 1
        });
        editor.setSelection(new monaco.Selection(pos.lineNumber, pos.column + 1, pos.lineNumber, pos.column + 1));
        editor.focus();
        return;
      }
    });

    // Refresh workspace file list on focus so autocomplete always has latest files
    editor.onDidFocusEditorText(() => {
      fetchWorkspaceFiles();
    });

    // Run initial LaTeX diagnostic check
    setTimeout(() => {
      if (editor.getModel()) {
        const text = editor.getModel().getValue();
        runLinter(text);
      }
    }, 150);
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
        runLinter(response.data);
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

    runLinter(newValue);

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

  const errorCount = diagnostics.filter(d => d.severity === 'error').length;
  const warningCount = diagnostics.filter(d => d.severity === 'warning').length;

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

          {/* Real-time LaTeX Diagnostics / Inspector */}
          {filePath?.endsWith('.tex') && (
            <button
              onClick={() => setShowIssues(!showIssues)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ml-1",
                errorCount > 0
                  ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  : warningCount > 0
                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              )}
              title={diagnostics.length > 0 ? "Click to view LaTeX suggestions & fixes" : "No LaTeX issues found"}
            >
              {errorCount > 0 ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span>{errorCount} {errorCount === 1 ? 'error' : 'errors'}</span>
                  {warningCount > 0 && <span className="text-zinc-400">, {warningCount} warn</span>}
                </>
              ) : warningCount > 0 ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{warningCount} {warningCount === 1 ? 'warning' : 'warnings'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="hidden sm:inline">Valid LaTeX</span>
                </>
              )}
              {diagnostics.length > 0 && (
                showIssues ? <ChevronUp className="w-3 h-3 ml-0.5 opacity-70" /> : <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
              )}
            </button>
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

      {/* Diagnostics Inspector Drawer */}
      {showIssues && diagnostics.length > 0 && (
        <div className="bg-zinc-900 border-b border-zinc-800 text-zinc-100 max-h-56 overflow-y-auto shrink-0 z-20 shadow-md">
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/80 border-b border-zinc-700/60 text-xs font-medium text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-indigo-400" />
              LaTeX Inspector & Suggestions ({diagnostics.length})
            </span>
            <button
              onClick={() => setShowIssues(false)}
              className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-zinc-800/60 text-xs">
            {diagnostics.map((diag) => (
              <div 
                key={diag.id}
                className="px-3 py-2 flex items-start justify-between gap-3 hover:bg-zinc-800/40 transition-colors"
              >
                <div 
                  className="flex items-start gap-2 cursor-pointer flex-1 min-w-0"
                  onClick={() => handleJumpToDiagnostic(diag)}
                >
                  {diag.severity === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-zinc-400 bg-zinc-800 px-1 rounded">
                        Ln {diag.line}
                      </span>
                      <span className="text-zinc-200 font-medium">
                        {diag.message}
                      </span>
                    </div>
                  </div>
                </div>

                {diag.quickFixes && diag.quickFixes.length > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {diag.quickFixes.map((fix, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleApplyFix(fix)}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                        title={fix.title}
                      >
                        <Sparkles className="w-3 h-3 text-indigo-200" />
                        <span>Fix</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
            quickSuggestions: !isLogFile ? { other: true, comments: false, strings: true } : false,
            suggestOnTriggerCharacters: !isLogFile,
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoClosingOvertype: 'always',
            autoClosingDelete: 'always',
            autoSurround: 'languageDefined',
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