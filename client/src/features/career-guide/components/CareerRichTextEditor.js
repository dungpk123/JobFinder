import React, { useEffect, useMemo, useRef } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Link,
  List,
  BlockQuote
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';
import './CareerRichTextEditor.css';

const CKEDITOR_PLUGINS = [
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Link,
  List,
  BlockQuote
];

const CKEDITOR_TOOLBAR = [
  'heading',
  '|',
  'bold',
  'italic',
  '|',
  'bulletedList',
  'numberedList',
  '|',
  'blockQuote',
  'link',
  '|',
  'undo',
  'redo'
];

const CKEDITOR_LICENSE_KEY =
  process.env.REACT_APP_CKEDITOR_LICENSE_KEY
  || process.env.VITE_CKEDITOR_LICENSE_KEY
  || 'GPL';

function CareerRichTextEditor({
  value,
  onChange,
  initialValue = '',
  placeholder = 'Viết nội dung bài viết...',
  minHeight = 300,
  className = '',
  disabled = false,
  toolbarMode = 'career'
}) {
  const editorRef = useRef(null);

  const normalizedValue = useMemo(() => {
    if (typeof value === 'string') return value;
    if (typeof initialValue === 'string') return initialValue;
    return '';
  }, [value, initialValue]);

  const editorConfig = useMemo(() => ({
    licenseKey: CKEDITOR_LICENSE_KEY,
    plugins: CKEDITOR_PLUGINS,
    toolbar: CKEDITOR_TOOLBAR,
    heading: {
      options: [
        { model: 'paragraph', title: 'Đoạn văn', class: 'ck-heading_paragraph' },
        { model: 'heading2', view: 'h2', title: 'Tiêu đề 2', class: 'ck-heading_heading2' },
        { model: 'heading3', view: 'h3', title: 'Tiêu đề 3', class: 'ck-heading_heading3' }
      ]
    },
    link: {
      addTargetToExternalLinks: true,
      defaultProtocol: 'https://'
    },
    placeholder: String(placeholder || 'Nhập nội dung...')
  }), [placeholder]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const current = editor.getData();
    if (current !== normalizedValue) {
      editor.setData(normalizedValue || '');
    }
  }, [normalizedValue]);

  useEffect(() => () => {
    editorRef.current = null;
  }, []);

  return (
    <div
      className={`cgrte cgrte-ckeditor ${toolbarMode === 'word-basic' ? 'cgrte-word-mode' : ''} ${className}`.trim()}
      style={{ '--cgrte-min-height': `${Math.max(140, Number(minHeight) || 300)}px` }}
    >
      <CKEditor
        editor={ClassicEditor}
        config={editorConfig}
        data={normalizedValue}
        disabled={disabled}
        onReady={(editor) => {
          editorRef.current = editor;
          if (editor.getData() !== normalizedValue) {
            editor.setData(normalizedValue || '');
          }
        }}
        onChange={(_, editor) => {
          if (typeof onChange === 'function') {
            onChange(editor.getData());
          }
        }}
      />
    </div>
  );
}

export default CareerRichTextEditor;
