import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { addDocument, updateDocument, deleteDocument, getDocuments } from '../services/firebaseConfig';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { marked } from 'marked';
import { Eye, Edit2, Save, Trash2, ArrowLeft, FileText } from 'lucide-react';
import styles from './DocumentEditor.module.css';

const DocumentEditor = ({ user }) => {
  const [title, setTitle] = useState('');
  const [documentId, setDocumentId] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [initialContent, setInitialContent] = useState('');
  const [isViewMode, setIsViewMode] = useState(false);
  const [sourceContent, setSourceContent] = useState('');
  const [editorContent, setEditorContent] = useState(''); // Track editor content separately
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Track when auto-saving occurs
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true); // Control auto-save
  const editorRef = useRef(null);
  const navigate = useNavigate();
  const { id, projectId } = useParams();
  const location = useLocation();

  useEffect(() => {
    const initializeDocument = async () => {
      // Check if view parameter is present in URL
      const params = new URLSearchParams(window.location.search);
      const viewMode = params.get('view') === 'true';
      
      if (viewMode) {
        setIsViewMode(true);
      }
      
      if (id) {
        await fetchDocument(id);
      } else if (location.state && location.state.initialContent) {
        const initialTitle = location.state.initialTitle || '';
        const content = location.state.initialContent;
        console.log('Setting initial content from location state:', content); // Debug log
        
        setTitle(initialTitle);
        setInitialContent(content);
        
        // Create a new document immediately
        const newDoc = await addDocument(initialTitle, content, user.uid, projectId, {
          source: 'native',
          isMarkdown: false
        });
        setDocumentId(newDoc.id);
        
        // Use setTimeout to ensure the content is set after navigation
        setTimeout(() => {
          if (editorRef.current) {
            console.log('Setting editor content after timeout');
            editorRef.current.setContent(content);
          }
        }, 100);
        
        navigate(`/project/${projectId}/documents/${newDoc.id}`, { replace: true, state: { initialContent: content, initialTitle: initialTitle } });
      }
    };

    initializeDocument();
  }, [id, location.state, user.uid, projectId, navigate]);

  useEffect(() => {
    if (editorRef.current && initialContent) {
      console.log('useEffect: Setting editor content from initialContent change');
      
      // Use a small delay to ensure the editor is ready
      setTimeout(() => {
        if (editorRef.current) {
          // If it's a Markdown document and we're in edit mode, convert to HTML first
          if (isMarkdown && !isViewMode) {
            // Use marked directly here
            const htmlContent = marked(initialContent);
            editorRef.current.setContent(htmlContent);
          } else {
            editorRef.current.setContent(initialContent);
          }
          // Force a re-render of the editor content
          editorRef.current.execCommand('mceRepaint');
        }
      }, 100);
    }
  }, [initialContent, isMarkdown, isViewMode]);

  const fetchDocument = async (docId) => {
    try {
      const docs = await getDocuments(user.uid, projectId);
      const doc = docs.find(d => d.id === docId);
      if (doc) {
        setTitle(doc.title);
        setDocumentId(docId);
        setSourceContent(doc.content);
        
        // Set last saved timestamp if document has an updatedAt property
        if (doc.updatedAt) {
          // Update the lastSaved state with the document's updatedAt timestamp
          const savedDate = new Date(doc.updatedAt.seconds * 1000);
          setLastSaved(savedDate);
          console.log("Setting last saved timestamp:", savedDate.toLocaleString());
          
          // Also update our lastSaveTimeRef to prevent immediate auto-save
          lastSaveTimeRef.current = Date.now();
        }
        
        // Check if document is explicitly marked as Markdown
        if (doc.isMarkdown !== undefined) {
          setIsMarkdown(doc.isMarkdown);
        } else {
          // Attempt to detect if the content is Markdown
          // Check for common Markdown patterns like # headers, - lists, etc.
          const isLikelyMarkdown = 
            /^#+ |^-\s|^[*-] |^>\s|\[.+\]\(.+\)|^```\w*\n|^\s*\[[x ]\]\s/m.test(doc.content) || 
            doc.source === 'task-conversion';  // Auto-detect documents from task conversion
          
          setIsMarkdown(isLikelyMarkdown);
        }
        
        // If document was created from task conversion, auto-switch to view mode
        if (doc.source === 'task-conversion') {
          setIsViewMode(true);
          // For Markdown content in edit mode, will need it as HTML
          if (doc.isMarkdown || isLikelyMarkdown) {
            setEditorContent(marked(doc.content));
          } else {
            setEditorContent(doc.content);
          }
          setInitialContent(doc.content); // Also set initial content for legacy support
        } else {
          // For normal documents, just set all content states
          setEditorContent(doc.content);
          setInitialContent(doc.content);
        }

        console.log("Document loaded:", {
          id: docId,
          isMarkdown: doc.isMarkdown || isLikelyMarkdown,
          isViewMode: doc.source === 'task-conversion',
          titleLength: doc.title?.length || 0,
          contentLength: doc.content?.length || 0,
          lastSaved: doc.updatedAt ? new Date(doc.updatedAt.seconds * 1000).toLocaleString() : 'none'
        });
      }
    } catch (error) {
      console.error('Error fetching document:', error);
    }
  };

  const saveDocument = useCallback(async () => {
    // Create local copies of state to avoid circular dependencies
    const currentIsViewMode = isViewMode;
    const currentIsMarkdown = isMarkdown;
    const currentSourceContent = sourceContent;
    const currentEditorContent = editorContent;
    
    // Determine what content to save based on the current mode
    let contentToSave;
    
    if (currentIsViewMode) {
      // In view mode, use the source content
      contentToSave = currentSourceContent;
    } else {
      // In edit mode, get the latest content from the editor
      // First try to get directly from the editor, fallback to our tracked state
      const latestContent = editorRef.current ? editorRef.current.getContent() : currentEditorContent;
      
      if (currentIsMarkdown) {
        // For Markdown documents, convert HTML to Markdown before saving
        // Inline conversion function
        const convertToMarkdown = (html) => {
          if (!html) return '';
          
          let md = html
            // Convert heading tags
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
            .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
            .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
            .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
            
            // Convert lists
            .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function(match, content) {
              return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
            })
            .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function(match, content) {
              let num = 1;
              return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function(match, item) {
                return (num++) + '. ' + item + '\n';
              });
            })
            
            // Convert checkboxes
            .replace(/<input[^>]*type=['"]checkbox['"][^>]*checked[^>]*>/gi, '[x] ')
            .replace(/<input[^>]*type=['"]checkbox['"][^>]*>/gi, '[ ] ')
            
            // Convert basic formatting
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
            
            // Remove paragraph tags but keep new lines
            .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
            
            // Preserve line breaks
            .replace(/<br[^>]*>/gi, '\n')
            
            // Remove any remaining HTML tags
            .replace(/<[^>]*>/g, '')
            
            // Fix repeated newlines
            .replace(/\n\s*\n\s*\n/g, '\n\n');
          
          return md.trim();
        };
        
        contentToSave = convertToMarkdown(latestContent);
        // Update our state to keep things in sync
        setSourceContent(contentToSave);
      } else {
        contentToSave = latestContent;
        // Update our state to keep things in sync
        setSourceContent(contentToSave);
      }
      
      // Always update editor content state
      setEditorContent(latestContent);
    }
    
    if (!contentToSave) {
      console.warn("No content to save");
      return Promise.resolve(false);
    }
    
    // Truncate long content for logging
    const previewContent = contentToSave.length > 100 
      ? contentToSave.substring(0, 100) + "..."
      : contentToSave;
    
    console.log('Content to save:', previewContent);

    try {
      if (documentId) {
        // Update existing document
        const updateData = {
          title,
          content: contentToSave,
          updatedAt: new Date(),
          // Keep track if this is markdown content
          isMarkdown: currentIsMarkdown
        };
        
        // Log with truncated content for debugging
        console.log('Updating document with data:', {
          ...updateData,
          content: updateData.content.length > 50 
            ? updateData.content.substring(0, 50) + "..."
            : updateData.content
        });
        
        await updateDocument(documentId, updateData);
        
        // Set last saved timestamp
        const savedTime = new Date();
        setLastSaved(savedTime);
        return Promise.resolve(true);
      } else {
        // Create new document
        const newDoc = await addDocument(title, contentToSave, user.uid, projectId, { 
          isMarkdown: currentIsMarkdown,
          source: "native" 
        });
        setDocumentId(newDoc.id);
        setLastSaved(new Date());
        navigate(`/project/${projectId}/documents/${newDoc.id}`, { replace: true });
        return Promise.resolve(true);
      }
    } catch (error) {
      console.error('Error saving document:', error);
      return Promise.reject(error);
    }
  }, [documentId, title, user?.uid, projectId, navigate, isViewMode, sourceContent, editorContent, isMarkdown]);

  // Track the last time we saved to avoid too-frequent saves
  const lastSaveTimeRef = useRef(0);
  
  useEffect(() => {
    // Only auto-save in edit mode and if enabled
    if (!isViewMode && autoSaveEnabled) {
      console.log("Auto-save enabled, setting up interval");
      
      // Simple auto-save every 15 seconds
      const autoSaveInterval = setInterval(() => {
        if (editorRef.current && documentId) {
          console.log("Auto-save check");
          
          // Get current content
          const currentContent = editorRef.current.getContent();
          
          // Save if there's content to save
          if (currentContent && currentContent.trim() !== '') {
            console.log("Auto-saving document");
            setIsSaving(true);
            
            saveDocument().then(() => {
              console.log("Auto-save completed successfully");
              // Update the lastSaveTimeRef
              lastSaveTimeRef.current = Date.now();
              setTimeout(() => {
                setIsSaving(false);
              }, 1000);
            }).catch(error => {
              console.error("Error in auto-save:", error);
              setIsSaving(false);
            });
          }
        }
      }, 15000); // Auto-save every 15 seconds
      
      return () => {
        console.log("Clearing auto-save interval");
        clearInterval(autoSaveInterval);
      };
    }
  }, [saveDocument, isViewMode, autoSaveEnabled, documentId]);
  
  // No utility functions defined at this level - 
  // We've moved conversion to inline functions inside the callbacks
  // where they are used

  // We'll use an inline function approach rather than defining
  // utility functions at the component level

  // Handle editor content changes - keeps state in sync without requiring save
  // Using debounce to prevent excessive state updates
  const handleEditorChange = () => {
    if (editorRef.current) {
      const currentContent = editorRef.current.getContent();
      // Only update state if content actually changed
      if (currentContent !== editorContent) {
        console.log("Content changed, updating state");
        setEditorContent(currentContent);
      }
    }
  };

  // Function to toggle between view and edit modes
  const toggleViewMode = async () => {
    // Create a local copy of current state to avoid circular dependencies
    const currentIsViewMode = isViewMode;
    const currentIsMarkdown = isMarkdown;
    const currentSourceContent = sourceContent;
    
    if (!currentIsViewMode) {
      // Switching TO view mode FROM edit mode
      // Get content from editor
      if (editorRef.current) {
        const htmlContent = editorRef.current.getContent();
        
        if (currentIsMarkdown) {
          // For Markdown documents, we need to convert editor's HTML to Markdown
          const convertHtml = (html) => {
            if (!html) return '';
            
            let md = html
              // Convert heading tags
              .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
              .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
              .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
              .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
              .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
              .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
              
              // Convert lists
              .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function(match, content) {
                return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
              })
              .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function(match, content) {
                let num = 1;
                return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function(match, item) {
                  return (num++) + '. ' + item + '\n';
                });
              })
              
              // Convert checkboxes
              .replace(/<input[^>]*type=['"]checkbox['"][^>]*checked[^>]*>/gi, '[x] ')
              .replace(/<input[^>]*type=['"]checkbox['"][^>]*>/gi, '[ ] ')
              
              // Convert basic formatting
              .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
              .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
              .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
              .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
              
              // Remove paragraph tags but keep new lines
              .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
              
              // Preserve line breaks
              .replace(/<br[^>]*>/gi, '\n')
              
              // Remove any remaining HTML tags
              .replace(/<[^>]*>/g, '')
              
              // Fix repeated newlines
              .replace(/\n\s*\n\s*\n/g, '\n\n');
            
            return md.trim();
          };
          
          // Convert HTML to Markdown for viewing
          const markdownContent = convertHtml(htmlContent);
          setSourceContent(markdownContent);
          setEditorContent(htmlContent);
        } else {
          // For regular documents, just use the HTML directly
          setSourceContent(htmlContent);
          setEditorContent(htmlContent);
        }
      }
      
      // Toggle the view mode
      setIsViewMode(true);
    } else {
      // Switching TO edit mode FROM view mode
      // We need to ensure we have the latest content from the database
      
      // First change the mode
      setIsViewMode(false);
      
      if (documentId) {
        console.log("Re-fetching document before switching to edit mode");
        setIsSaving(true);
        
        try {
          // Fetch the latest document state from the database
          const docs = await getDocuments(user.uid, projectId);
          const latestDoc = docs.find(d => d.id === documentId);
          
          if (latestDoc) {
            console.log("Retrieved latest document version for edit mode");
            
            // Update state with latest content
            setSourceContent(latestDoc.content);
            
            // Update last saved timestamp
            if (latestDoc.updatedAt) {
              const savedDate = new Date(latestDoc.updatedAt.seconds * 1000);
              setLastSaved(savedDate);
              lastSaveTimeRef.current = Date.now();
            }
            
            // Use a longer timeout to ensure the editor is fully ready after state updates
            setTimeout(() => {
              try {
                if (editorRef.current) {
                  // If it's a Markdown document, convert to HTML for editing
                  if (latestDoc.isMarkdown) {
                    const html = marked(latestDoc.content);
                    editorRef.current.setContent(html);
                    setEditorContent(html);
                  } else {
                    // For regular HTML documents, just set it directly
                    editorRef.current.setContent(latestDoc.content);
                    setEditorContent(latestDoc.content);
                  }
                  
                  // Force repaint
                  editorRef.current.execCommand('mceRepaint');
                }
                setIsSaving(false);
              } catch (error) {
                console.error("Error setting editor content:", error);
                setIsSaving(false);
              }
            }, 200);
          } else {
            console.error("Could not find document in database");
            setIsSaving(false);
            
            // Fall back to using the current content if we can't fetch the latest
            setTimeout(() => {
              try {
                if (editorRef.current) {
                  if (currentIsMarkdown) {
                    // Convert Markdown to HTML for the editor
                    const html = marked(currentSourceContent);
                    editorRef.current.setContent(html);
                    setEditorContent(html);
                  } else {
                    // For regular HTML documents, just set it directly
                    editorRef.current.setContent(currentSourceContent);
                    setEditorContent(currentSourceContent);
                  }
                  
                  // Force repaint
                  editorRef.current.execCommand('mceRepaint');
                }
              } catch (error) {
                console.error("Error setting editor content:", error);
              }
            }, 200);
          }
        } catch (error) {
          console.error("Error fetching document for edit mode:", error);
          setIsSaving(false);
          
          // Fall back to using the current content if we can't fetch the latest
          setTimeout(() => {
            try {
              if (editorRef.current) {
                if (currentIsMarkdown) {
                  // Convert Markdown to HTML for the editor
                  const html = marked(currentSourceContent);
                  editorRef.current.setContent(html);
                  setEditorContent(html);
                } else {
                  // For regular HTML documents, just set it directly
                  editorRef.current.setContent(currentSourceContent);
                  setEditorContent(currentSourceContent);
                }
                
                // Force repaint
                editorRef.current.execCommand('mceRepaint');
              }
            } catch (error) {
              console.error("Error setting editor content:", error);
            }
          }, 200);
        }
      } else {
        // If no document ID (new document), just use the current content
        setTimeout(() => {
          try {
            if (editorRef.current) {
              if (currentIsMarkdown) {
                // Convert Markdown to HTML for the editor
                const html = marked(currentSourceContent);
                editorRef.current.setContent(html);
                setEditorContent(html);
              } else {
                // For regular HTML documents, just set it directly
                editorRef.current.setContent(currentSourceContent);
                setEditorContent(currentSourceContent);
              }
              
              // Force repaint
              editorRef.current.execCommand('mceRepaint');
            }
          } catch (error) {
            console.error("Error setting editor content:", error);
          }
        }, 200);
      }
    }
  };

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

  const renderMarkdownContent = () => {
    if (!sourceContent) return '';
    
    // Simpler approach - just use marked directly
    // with basic options, and then post-process the HTML
    try {
      marked.setOptions({
        gfm: true, // GitHub Flavored Markdown
        breaks: true, // Add <br> on single line breaks
        smartLists: true,
      });
      
      // Get the HTML content
      let htmlContent = marked(sourceContent);
      
      // Post-process the HTML to handle checkbox items
      // First, convert Markdown style checkboxes that didn't get properly converted
      htmlContent = htmlContent
        .replace(/<li>\s*\[ \]\s*(.*?)<\/li>/gi, '<li><input type="checkbox" disabled> $1</li>')
        .replace(/<li>\s*\[x\]\s*(.*?)<\/li>/gi, '<li><input type="checkbox" checked disabled> $1</li>')
        .replace(/<p>\s*\[ \]\s*(.*?)<\/p>/gi, '<p><input type="checkbox" disabled> $1</p>')
        .replace(/<p>\s*\[x\]\s*(.*?)<\/p>/gi, '<p><input type="checkbox" checked disabled> $1</p>');
      
      return (
        <div 
          className={styles.markdownPreview} 
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      );
    } catch (error) {
      console.error("Error rendering markdown:", error);
      // Fallback to display plain text if there's an error
      return (
        <div className={styles.markdownPreview}>
          <pre>{sourceContent}</pre>
        </div>
      );
    }
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.backButtonContainer}>
        <button 
          onClick={() => navigate(`/project/${projectId}/documents`)}
          className={styles.backButton}
          title="Back to Documents"
        >
          <ArrowLeft size={16} /> Back to Documents
        </button>
      </div>
      
      <div className={styles.editorHeader}>
        <div className={styles.headerLeft}>
          {isViewMode ? (
            <h2 className={styles.documentTitle}>{title}</h2>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document Title"
              className={styles.titleInput}
            />
          )}
        </div>
        
        <div className={styles.editorControls}>
          {isMarkdown && (
            <span className={styles.markdownBadge} title="This document uses Markdown formatting">
              MD
            </span>
          )}
          
          <button 
            onClick={async () => {
              // If we're in edit mode and about to switch to view mode,
              // manually trigger a save first to ensure content is preserved
              if (!isViewMode && editorRef.current) {
                console.log("Ensuring content is saved before toggling to view mode");
                setIsSaving(true);
                
                try {
                  // Force an update of editorContent to ensure we have the latest
                  const currentContent = editorRef.current.getContent();
                  if (currentContent !== editorContent) {
                    setEditorContent(currentContent);
                    // Wait a moment for state to update
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                  
                  // Now trigger the save
                  await saveDocument();
                  
                  // Wait briefly to ensure the save completes
                  await new Promise(resolve => setTimeout(resolve, 300));
                  setIsSaving(false);
                  
                  // Now toggle the view mode
                  toggleViewMode();
                } catch (error) {
                  console.error("Error saving before toggle:", error);
                  setIsSaving(false);
                  // Still try to toggle even if save fails
                  toggleViewMode();
                }
              } else {
                // If we're in view mode, just toggle directly
                toggleViewMode();
              }
            }} 
            className={`${styles.modeToggleButton} ${isViewMode ? styles.editModeButton : styles.viewModeButton}`}
            title={isViewMode ? "Switch to Edit Mode" : "Switch to View Mode"}
          >
            {isViewMode ? <Edit2 size={16} /> : <Eye size={16} />}
            {isViewMode ? " Edit" : " View"}
          </button>
        </div>
      </div>
      
      {isViewMode ? (
        <div className={styles.viewModeContainer}>
          {renderMarkdownContent()}
        </div>
      ) : (
        <div className={styles.editorWrapper}>
          <Editor
            apiKey="g4hs9khfgw1uugaf6xwxnbr465wiilodw9q7ztifembowdp5"
            initialValue=""
            onInit={(evt, editor) => {
              editorRef.current = editor;
              console.log('Editor initialized');
              
              // Double-check to ensure content is set
              setTimeout(() => {
                // First try the tracked editor content
                if (editorContent) {
                  console.log('Setting editor content from editorContent state');
                  editor.setContent(editorContent);
                  
                } else if (initialContent) {
                  console.log('Setting editor content from initialContent');
                  // If it's a Markdown document, convert to HTML for editing
                  if (isMarkdown) {
                    const htmlContent = marked(initialContent);
                    editor.setContent(htmlContent);
                    setEditorContent(htmlContent); // Update our tracked state
                  } else {
                    editor.setContent(initialContent);
                    setEditorContent(initialContent); // Update our tracked state
                  }
                }
              }, 50);
            }}
            onBlur={() => handleEditorChange()}
            init={{
              height: 500,
              menubar: false,
              plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount linkchecker',
              toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table | align lineheight | numlist bullist indent outdent | emoticons charmap | removeformat',
              content_style: 'body { font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#1e293b; }',
              setup: (editor) => {
                // Track content changes only when done typing or on keyup with a delay
                let typingTimer;
                const doneTypingInterval = 1000; // Wait 1 second after typing stops
                
                // Clear timer on keydown and set it again on keyup
                editor.on('keydown', () => {
                  clearTimeout(typingTimer);
                });
                
                editor.on('keyup', () => {
                  clearTimeout(typingTimer);
                  typingTimer = setTimeout(() => {
                    handleEditorChange();
                  }, doneTypingInterval);
                });
                
                // Also track when user exits the editor
                editor.on('Blur', () => {
                  clearTimeout(typingTimer);
                  handleEditorChange();
                });
                
                editor.on('init', () => {
                  // One more check to ensure content is set after editor is fully initialized
                  if (editorContent) {
                    console.log('Setting content on editor fully initialized from editorContent state');
                    editor.setContent(editorContent);
                  } else if (initialContent) {
                    console.log('Setting content on editor fully initialized from initialContent');
                    
                    // If it's a Markdown document, convert to HTML for editing
                    if (isMarkdown) {
                      const htmlContent = marked(initialContent);
                      editor.setContent(htmlContent);
                      setEditorContent(htmlContent); // Update our tracked state
                    } else {
                      editor.setContent(initialContent);
                      setEditorContent(initialContent); // Update our tracked state
                    }
                  }
                });
              }
            }}
          />
        </div>
      )}
      
      <div className={styles.editorActions}>
        <div className={styles.actionButtonsGroup}>
          {!isViewMode && (
            <button 
              onClick={async () => {
                setIsSaving(true);
                try {
                  await saveDocument();
                  // Update the lastSaveTimeRef to prevent immediate auto-save
                  lastSaveTimeRef.current = Date.now();
                  setTimeout(() => setIsSaving(false), 1000);
                } catch (error) {
                  console.error('Error saving document:', error);
                  setIsSaving(false);
                }
              }} 
              className={styles.saveButton}
              disabled={isSaving}
            >
              <Save size={16} /> {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
          
          {documentId && (
            <button onClick={handleDelete} className={styles.deleteButton}>
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
        
        {!isViewMode && (
          <label className={styles.autoSaveToggle}>
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={() => setAutoSaveEnabled(!autoSaveEnabled)}
            />
            Auto-save
          </label>
        )}
      </div>
      
      <p className={styles.lastSaved}>
        {isSaving ? (
          <span className={styles.savingIndicator}>
            <Save size={14} /> Saving...
          </span>
        ) : lastSaved ? (
          <>
            <FileText size={14} /> Last saved: {lastSaved.toLocaleString()}
          </>
        ) : (
          <>
            <FileText size={14} /> Document not saved yet
          </>
        )}
      </p>
    </div>
  );
};

export default DocumentEditor;