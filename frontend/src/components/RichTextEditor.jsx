import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser, CornerDownLeft } from 'lucide-react';

const ToolbarButton = ({ onAction, title, testid, children }) => (
  <button
    type="button"
    title={title}
    data-testid={testid}
    // preventDefault on mousedown keeps the editor's text selection intact
    onMouseDown={(e) => { e.preventDefault(); onAction(); }}
    className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 hover:bg-[#E8772E]/10 hover:text-[#E8772E] transition-colors"
  >
    {children}
  </button>
);

export const RichTextEditor = forwardRef(({ value, onChange, placeholder }, ref) => {
  const editorRef = useRef(null);

  // Initialize content once on mount (uncontrolled to avoid caret jumps)
  useEffect(() => {
    if (editorRef.current && value && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, []); // run only on mount

  const emitChange = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const focusEditor = () => {
    const editor = editorRef.current;
    editor.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount || !editor.contains(sel.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const exec = (command, arg = null) => {
    focusEditor();
    document.execCommand(command, false, arg);
    emitChange();
  };

  const insertText = (text) => {
    focusEditor();
    document.execCommand('insertText', false, text);
    emitChange();
  };

  const insertLink = () => {
    const url = window.prompt('URL del enlace (incluye https://):', 'https://');
    if (url && url !== 'https://') exec('createLink', url);
  };

  useImperativeHandle(ref, () => ({
    insertVariable: (variable) => insertText(variable),
  }));

  return (
    <div className="border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#E8772E]/40 focus-within:border-[#E8772E]">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-gray-50 flex-wrap" data-testid="editor-toolbar">
        <ToolbarButton onAction={() => exec('bold')} title="Negrita" testid="btn-bold"><Bold className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onAction={() => exec('italic')} title="Cursiva" testid="btn-italic"><Italic className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onAction={() => exec('underline')} title="Subrayado" testid="btn-underline"><Underline className="w-4 h-4" /></ToolbarButton>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolbarButton onAction={() => exec('insertUnorderedList')} title="Lista con viñetas" testid="btn-ul"><List className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onAction={() => exec('insertOrderedList')} title="Lista numerada" testid="btn-ol"><ListOrdered className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onAction={insertLink} title="Insertar enlace" testid="btn-link"><Link2 className="w-4 h-4" /></ToolbarButton>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolbarButton onAction={() => exec('insertLineBreak')} title="Salto de línea" testid="btn-linebreak"><CornerDownLeft className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onAction={() => exec('removeFormat')} title="Quitar formato" testid="btn-clear"><Eraser className="w-4 h-4" /></ToolbarButton>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        data-placeholder={placeholder}
        data-testid="rich-text-editor"
        className="rich-editor min-h-[260px] max-h-[420px] overflow-y-auto px-4 py-3 text-sm text-gray-800 leading-relaxed focus:outline-none"
      />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';
