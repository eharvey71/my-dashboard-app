import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { addDocument, updateDocument, deleteDocument, getDocuments } from '../services/firebaseConfig';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import styles from './DocumentEditor.module.css';

const DocumentEditor = ({ user }) => {
  const [title, setTitle] = useState('');
  const [documentId, setDocumentId] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [initialContent, setInitialContent] = useState('');
  const editorRef = useRef(null);
  const navigate = useNavigate();
  const { id, projectId } = useParams();
  const location = useLocation();

  useEffect(() => {
    const initializeDocument = async () => {
      if (id) {
        await fetchDocument(id);
      } else if (location.state && location.state.initialContent) {
        const initialTitle = location.state.initialTitle || '';
        const content = location.state.initialContent;
        setTitle(initialTitle);
        setInitialContent(content);
        // Create a new document immediately
        const newDoc = await addDocument(initialTitle, content, user.uid, projectId);
        setDocumentId(newDoc.id);
        navigate(`/project/${projectId}/documents/${newDoc.id}`, { replace: true });
      }
    };

    initializeDocument();
  }, [id, location.state, user.uid, projectId, navigate]);

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.setContent(initialContent);
    }
  }, [initialContent]);

  const fetchDocument = async (docId) => {
    try {
      const docs = await getDocuments(user.uid, projectId);
      const doc = docs.find(d => d.id === docId);
      if (doc) {
        setTitle(doc.title);
        setDocumentId(docId);
        setInitialContent(doc.content);
      }
    } catch (error) {
      console.error('Error fetching document:', error);
    }
  };

  const saveDocument = useCallback(async () => {
    if (!editorRef.current) return;

    const currentContent = editorRef.current.getContent();
    console.log('Current content before save:', currentContent); // Debug log

    try {
      if (documentId) {
        // Update existing document
        const updateData = {
          title,
          content: currentContent,
          updatedAt: new Date()
        };
        console.log('Updating document with data:', updateData); // Debug log
        await updateDocument(documentId, updateData);
      } else {
        // Create new document
        const newDoc = await addDocument(title, currentContent, user.uid, projectId);
        setDocumentId(newDoc.id);
        navigate(`/project/${projectId}/documents/${newDoc.id}`, { replace: true });
      }
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving document:', error);
    }
  }, [documentId, title, user.uid, projectId, navigate]);

  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (editorRef.current) {
        saveDocument();
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [saveDocument]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDocument(documentId);
        navigate(`/project/${projectId}/documents`);
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    }
  };

  return (
    <div className={styles.editorContainer}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Document Title"
        className={styles.titleInput}
      />
      <Editor
        apiKey="g4hs9khfgw1uugaf6xwxnbr465wiilodw9q7ztifembowdp5"
        onInit={(evt, editor) => {
          editorRef.current = editor;
          if (initialContent) {
            editor.setContent(initialContent);
          }
        }}
        init={{
          height: 500,
          menubar: false,
          plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount linkchecker',
          toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table | align lineheight | numlist bullist indent outdent | emoticons charmap | removeformat',
          content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
        }}
      />
      <div className={styles.editorActions}>
        <button onClick={saveDocument} className={styles.saveButton}>
          Save Document
        </button>
        {documentId && (
          <button onClick={handleDelete} className={styles.deleteButton}>
            Delete Document
          </button>
        )}
      </div>
      {lastSaved && (
        <p className={styles.lastSaved}>
          Last saved: {lastSaved.toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default DocumentEditor;