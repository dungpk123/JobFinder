import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Italic,
  List,
  ListOrdered,
  Link,
  Link2Off,
  Pilcrow,
  Quote,
} from 'lucide-react';
import './CareerRichTextEditor.css';

const CAREER_TOOLBAR_ITEMS = [
  { command: 'formatBlock', value: 'h2', icon: Pilcrow, label: 'Tiêu đề lớn', glyphText: 'H2', isToggle: false },
  { command: 'formatBlock', value: 'h3', icon: Pilcrow, label: 'Tiêu đề nhỏ', glyphText: 'H3', isToggle: false },
  { command: 'bold', icon: Bold, label: 'Đậm', isToggle: true },
  { command: 'italic', icon: Italic, label: 'Nghiêng', isToggle: true },
  { command: 'insertUnorderedList', icon: List, label: 'Danh sách', isToggle: true },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Đánh số', isToggle: true },
  { command: 'blockquote', icon: Quote, label: 'Trích dẫn', isToggle: false },
  { command: 'createLink', icon: Link, label: 'Chèn liên kết', isToggle: false },
  { command: 'unlink', icon: Link2Off, label: 'Bỏ liên kết', isToggle: false },
  { command: 'removeFormat', icon: Eraser, label: 'Xóa định dạng', isToggle: false }
];

const DEFAULT_ACTIVE_COMMANDS = {
  formatBlock: 'p',
  bold: false,
  italic: false,
  underline: false,
  insertUnorderedList: false,
  insertOrderedList: false,
  justifyLeft: false,
  justifyCenter: false,
  justifyRight: false,
  justifyFull: false
};

const normalizeFormatBlockValue = (value = '') => {
  const normalized = String(value || '')
    .replace(/[<>]/g, '')
    .trim()
    .toLowerCase();

  if (!normalized || normalized === 'div' || normalized === 'normal') return 'p';
  return normalized;
};

function CareerRichTextEditor({
  value,
  onChange,
  initialValue = '',
  placeholder = 'Viết nội dung bài viết...',
  minHeight = 300,
  className = '',
  toolbarMode = 'career'
}) {
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [activeCommands, setActiveCommands] = useState(DEFAULT_ACTIVE_COMMANDS);

  const normalizedValue = useMemo(() => {
    if (typeof value === 'string') return value;
    if (typeof initialValue === 'string') return initialValue;
    return '';
  }, [value, initialValue]);

  const isWordMode = toolbarMode === 'word-basic';

  useEffect(() => {
    if (!editorRef.current) return;
    if (focused) return;
    if (editorRef.current.innerHTML === normalizedValue) return;
    editorRef.current.innerHTML = normalizedValue;
  }, [normalizedValue, focused]);

  const emitChange = () => {
    if (!editorRef.current || typeof onChange !== 'function') return;
    onChange(editorRef.current.innerHTML);
  };

  const saveSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !editor.contains(anchorNode)) return;

    selectionRef.current = range.cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current;
    const range = selectionRef.current;
    if (!editor) return;

    if (!range) {
      editor.focus();
      return;
    }

    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return;

    const selection = window.getSelection?.();
    if (!selection) return;

    try {
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // noop
    }
  }, []);

  const updateActiveToolbarState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection?.();
    const anchorNode = selection?.anchorNode || null;
    const isInsideEditor = Boolean(anchorNode && editor.contains(anchorNode));

    if (!isInsideEditor) {
      setActiveCommands(DEFAULT_ACTIVE_COMMANDS);
      return;
    }

    const queryState = (command) => {
      try {
        return Boolean(document.queryCommandState(command));
      } catch {
        return false;
      }
    };

    const queryFormatBlock = () => {
      try {
        return normalizeFormatBlockValue(document.queryCommandValue('formatBlock'));
      } catch {
        return 'p';
      }
    };

    setActiveCommands({
      formatBlock: queryFormatBlock(),
      bold: queryState('bold'),
      italic: queryState('italic'),
      underline: queryState('underline'),
      insertUnorderedList: queryState('insertUnorderedList'),
      insertOrderedList: queryState('insertOrderedList'),
      justifyLeft: queryState('justifyLeft'),
      justifyCenter: queryState('justifyCenter'),
      justifyRight: queryState('justifyRight'),
      justifyFull: queryState('justifyFull')
    });

  }, []);

  const focusEditor = () => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const resetEmptyEditorRootFormatting = useCallback(() => {
    if (!isWordMode) return;

    const editor = editorRef.current;
    if (!editor) return;

    const plainText = String(editor.textContent || '').replace(/\u200B/g, '').trim();
    if (plainText) return;

    if (editor.style.fontSize) {
      editor.style.fontSize = '';
    }
    if (editor.style.textAlign) {
      editor.style.textAlign = '';
    }

    try {
      document.execCommand('justifyLeft', false, null);
    } catch {
      // noop
    }
  }, [isWordMode]);

  const runRemoveFormatting = () => {
    focusEditor();
    restoreSelection();

    const selection = window.getSelection?.();
    const hasSelection = Boolean(selection && selection.rangeCount > 0);
    const isCollapsed = hasSelection ? selection.getRangeAt(0).collapsed : true;

    if (isCollapsed) {
      const deactivate = (command) => {
        try {
          if (document.queryCommandState(command)) {
            document.execCommand(command, false, null);
          }
        } catch {
          // noop
        }
      };

      deactivate('bold');
      deactivate('italic');
      deactivate('underline');
      deactivate('insertUnorderedList');
      deactivate('insertOrderedList');

      try {
        document.execCommand('justifyLeft', false, null);
      } catch {
        // noop
      }
    } else {
      document.execCommand('removeFormat', false, null);
      document.execCommand('unlink', false, null);
    }

    emitChange();
    saveSelection();
    updateActiveToolbarState();
  };

  const applyCommand = (command, commandValue) => {
    focusEditor();
    restoreSelection();

    if (command === 'blockquote') {
      document.execCommand('formatBlock', false, 'blockquote');
      emitChange();
      saveSelection();
      updateActiveToolbarState();
      return;
    }

    if (command === 'createLink') {
      const url = window.prompt('Nhập liên kết (https://...)');
      if (url && url.trim()) {
        document.execCommand('createLink', false, url.trim());
        emitChange();
        saveSelection();
        updateActiveToolbarState();
      }
      return;
    }

    if (command === 'formatBlock') {
      const targetBlock = normalizeFormatBlockValue(commandValue || 'p');
      const currentBlock = normalizeFormatBlockValue(activeCommands.formatBlock || 'p');
      const nextBlock = isWordMode && targetBlock !== 'p' && currentBlock === targetBlock ? 'p' : targetBlock;

      document.execCommand('formatBlock', false, nextBlock);
      emitChange();
      saveSelection();
      updateActiveToolbarState();
      return;
    }

    if (isWordMode && (command === 'justifyCenter' || command === 'justifyRight' || command === 'justifyFull')) {
      const nextCommand = activeCommands[command] ? 'justifyLeft' : command;
      document.execCommand(nextCommand, false, null);
      emitChange();
      saveSelection();
      updateActiveToolbarState();
      return;
    }

    if (command === 'removeFormat') {
      runRemoveFormatting();
      return;
    }

    document.execCommand(command, false, commandValue || null);
    emitChange();
    saveSelection();
    updateActiveToolbarState();
  };

  const renderIconButton = ({ command, value, icon: Icon, label, isToggle, iconText, active }) => {
    const isActive = typeof active === 'boolean' ? active : Boolean(isToggle && activeCommands[command]);

    return (
      <button
        key={command + (value || '')}
        type="button"
        className={`cgrte-toolbar-btn ${isActive ? 'is-active' : ''}`.trim()}
        title={label}
        aria-label={label}
        aria-pressed={isToggle ? isActive : undefined}
        onMouseDown={(event) => {
          event.preventDefault();
          saveSelection();
        }}
        onClick={() => applyCommand(command, value)}
      >
        {iconText ? <span className="cgrte-icon-text">{iconText}</span> : <Icon size={16} strokeWidth={2.2} aria-hidden="true" />}
      </button>
    );
  };

  const renderCareerButton = ({ command, value, icon: Icon, label, isToggle, glyphText }) => {
    const isActive = Boolean(isToggle && activeCommands[command]);

    return (
      <button
        key={command + (value || '')}
        type="button"
        className={`cgrte-toolbar-btn cgrte-toolbar-btn-text ${isActive ? 'is-active' : ''}`.trim()}
        title={label}
        aria-label={label}
        aria-pressed={isToggle ? isActive : undefined}
        onMouseDown={(event) => {
          event.preventDefault();
          saveSelection();
        }}
        onClick={() => applyCommand(command, value)}
      >
        {glyphText ? <span className="cgrte-text-glyph">{glyphText}</span> : <Icon size={15} strokeWidth={2.2} aria-hidden="true" />}
        <span className="cgrte-btn-label">{label}</span>
      </button>
    );
  };

  const renderToolbar = () => {
    if (!isWordMode) {
      return (
        <div className="cgrte-toolbar cgrte-toolbar-career" role="toolbar" aria-label="Công cụ định dạng nội dung">
          {CAREER_TOOLBAR_ITEMS.map((item) => renderCareerButton(item))}
        </div>
      );
    }

    const activeBlock = normalizeFormatBlockValue(activeCommands.formatBlock || 'p');

    return (
      <div className="cgrte-toolbar cgrte-toolbar-word" role="toolbar" aria-label="Công cụ định dạng nội dung kiểu Word">
        <div className="cgrte-toolbar-group cgrte-toolbar-group-font" aria-label="Nhóm chữ">
          {renderIconButton({ command: 'formatBlock', value: 'h2', label: 'Tiêu đề lớn', isToggle: true, iconText: 'H2', active: activeBlock === 'h2' })}
          {renderIconButton({ command: 'formatBlock', value: 'h3', label: 'Tiêu đề nhỏ', isToggle: true, iconText: 'H3', active: activeBlock === 'h3' })}
          {renderIconButton({ command: 'formatBlock', value: 'p', label: 'Đoạn văn', isToggle: true, iconText: 'P', active: activeBlock === 'p' })}
          {renderIconButton({ command: 'bold', icon: Bold, label: 'Đậm', isToggle: true })}
        </div>

        <div className="cgrte-toolbar-divider" aria-hidden="true"></div>

        <div className="cgrte-toolbar-group" aria-label="Nhóm đoạn văn">
          {renderIconButton({ command: 'justifyLeft', icon: AlignLeft, label: 'Căn trái', isToggle: true })}
          {renderIconButton({ command: 'justifyCenter', icon: AlignCenter, label: 'Căn giữa', isToggle: true })}
          {renderIconButton({ command: 'justifyRight', icon: AlignRight, label: 'Căn phải', isToggle: true })}
          {renderIconButton({ command: 'justifyFull', icon: AlignJustify, label: 'Căn đều', isToggle: true })}
          {renderIconButton({ command: 'insertUnorderedList', icon: List, label: 'Danh sách gạch đầu dòng', isToggle: true })}
          {renderIconButton({ command: 'insertOrderedList', icon: ListOrdered, label: 'Danh sách đánh số', isToggle: true })}
        </div>

        <div className="cgrte-toolbar-divider" aria-hidden="true"></div>

        <div className="cgrte-toolbar-group" aria-label="Nhóm dọn định dạng">
          {renderIconButton({ command: 'removeFormat', icon: Eraser, label: 'Xóa định dạng', isToggle: false })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!focused) return undefined;

    const handleSelectionChange = () => {
      const editor = editorRef.current;
      const selection = window.getSelection?.();
      if (!editor || !selection || selection.rangeCount === 0) return;
      if (!editor.contains(selection.anchorNode)) return;

      saveSelection();
      updateActiveToolbarState();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [focused, saveSelection, updateActiveToolbarState]);

  return (
    <div className={`cgrte ${focused ? 'is-focused' : ''} ${className}`.trim()}>
      {renderToolbar()}

      <div
        ref={editorRef}
        className="cgrte-content"
        contentEditable
        role="textbox"
        aria-label="Trình soạn thảo nội dung bài viết"
        aria-multiline="true"
        data-placeholder={placeholder}
        style={{ minHeight }}
        suppressContentEditableWarning
        onInput={() => {
          emitChange();
          saveSelection();
          updateActiveToolbarState();
        }}
        onFocus={() => {
          setFocused(true);
          resetEmptyEditorRootFormatting();
          saveSelection();
          updateActiveToolbarState();
        }}
        onBlur={() => {
          setFocused(false);
          saveSelection();
          updateActiveToolbarState();
        }}
        onKeyUp={() => {
          saveSelection();
          updateActiveToolbarState();
        }}
        onMouseUp={() => {
          saveSelection();
          updateActiveToolbarState();
        }}
      />
    </div>
  );
}

export default CareerRichTextEditor;
