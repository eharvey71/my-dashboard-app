import React, { useState, useEffect } from 'react';
import { X, Folder, FileText, ChevronLeft } from 'lucide-react';
import styles from './GoogleDrivePicker.module.css';
import { listFiles, getFileContent } from '../services/googleDriveService';

const GoogleDrivePicker = ({ isOpen, onClose, onSelect }) => {
  const [currentFolder, setCurrentFolder] = useState('root');
  const [folderStack, setFolderStack] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFiles(currentFolder);
    }
  }, [isOpen, currentFolder]);

  const fetchFiles = async (folderId) => {
    setLoading(true);
    try {
      const fetchedFiles = await listFiles(folderId);
      setFiles(fetchedFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
    setLoading(false);
  };

  const handleFolderClick = (folderId, folderName) => {
    setFolderStack([...folderStack, { id: currentFolder, name: folderName }]);
    setCurrentFolder(folderId);
  };

  const handleBackClick = () => {
    if (folderStack.length > 0) {
      const newStack = [...folderStack];
      const previousFolder = newStack.pop();
      setFolderStack(newStack);
      setCurrentFolder(previousFolder.id);
    }
  };

  const handleFileSelect = async (file) => {
    try {
      const content = await getFileContent(file.id, file.mimeType);
      onSelect({ ...file, content });
      onClose();
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Select a file from Google Drive</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={24} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {folderStack.length > 0 && (
            <button onClick={handleBackClick} className={styles.backButton}>
              <ChevronLeft size={18} /> Back
            </button>
          )}
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <ul className={styles.fileList}>
              {files.map((file) => (
                <li key={file.id} className={styles.fileItem}>
                  {file.mimeType === 'application/vnd.google-apps.folder' ? (
                    <button
                      onClick={() => handleFolderClick(file.id, file.name)}
                      className={styles.folderButton}
                    >
                      <Folder size={18} /> {file.name}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFileSelect(file)}
                      className={styles.fileButton}
                    >
                      <FileText size={18} /> {file.name}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleDrivePicker;