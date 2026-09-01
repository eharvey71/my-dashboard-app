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
          // If it's a Markdown document (or from task conversion) and we're in edit mode, convert to HTML first
          if ((isMarkdown || sourceContent.indexOf('##') >= 0) && !isViewMode) {
            // Configure marked options
            marked.setOptions({
              gfm: true,          // GitHub Flavored Markdown
              breaks: true,       // Add <br> on single line breaks
              smartLists: true,
            });
            
            // Process markdown into properly structured HTML
            let htmlContent = marked(initialContent);
            
            // Additional processing to ensure proper structure in TinyMCE
            htmlContent = htmlContent
              // Ensure list items have proper breaks
              .replace(/<\/li><li>/g, '</li>\n<li>')
              // Format task list items better
              .replace(/<input type="checkbox" disabled>/g, '<input type="checkbox">')
              .replace(/<input type="checkbox" checked disabled>/g, '<input type="checkbox" checked>');
              
            // For markdown documents, use direct code editor approach
            if (isMarkdown || (htmlContent.includes('# ') && !htmlContent.includes('<h1>'))) {
              // Get the markdown content directly
              let markdownContent = initialContent;
              
              // If HTML content starts with markdown patterns, extract them
              if (htmlContent.match(/<p>\s*#\s+/)) {
                markdownContent = htmlContent.replace(/<p>([^<]+)<\/p>/g, '$1\n').trim();
              }
              
              // Normalize line breaks before inserting into editor
              const normalizedContent = markdownContent
                .replace(/\r\n/g, '\n')  // Convert Windows line breaks
                .replace(/\r/g, '\n')    // Convert old Mac line breaks
                .replace(/\n{3,}/g, '\n\n'); // Limit excessive line breaks
              
              // Create a simulated code editor for markdown - with better pre tag attributes
              const formattedHtml = `<pre class="markdown-editor" contenteditable="true" style="white-space: pre-wrap; font-family: monospace; padding: 10px; background: #f8f9fa; border: none; outline: none; width: 100%; height: 100%; overflow: auto; line-height: 1.5;">${normalizedContent
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</pre>
                <div style="font-size: 11px; color: #6c757d; padding: 5px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Markdown editor mode</div>`;
              
              // Set raw HTML content to bypass TinyMCE parsing
              editorRef.current.getBody().innerHTML = formattedHtml;
              
              // Add a class to the editor content to mark it as markdown in pre format
              setTimeout(() => {
                if (editorRef.current) {
                  const editorBody = editorRef.current.getBody();
                  if (editorBody) {
                    editorBody.classList.add('markdown-pre-format');
                    // Disable TinyMCE complex formatting features
                    editorRef.current.getDoc().execCommand('styleWithCSS', false, false);
                  }
                }
              }, 100);
            } else {
              editorRef.current.setContent(htmlContent);
            }
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
        
        // Check if document is explicitly marked as Markdown and store the result
        let detectMarkdown = false;
        if (doc.isMarkdown !== undefined) {
          detectMarkdown = doc.isMarkdown;
          setIsMarkdown(doc.isMarkdown);
        } else {
          // Attempt to detect if the content is Markdown
          // Check for common Markdown patterns like # headers, - lists, etc.
          detectMarkdown = 
            /^#+ |^-\s|^[*-] |^>\s|\[.+\]\(.+\)|^```\w*\n|^\s*\[[x ]\]\s/m.test(doc.content) || 
            doc.source === 'task-conversion' ||  // Auto-detect documents from task conversion
            doc.content.indexOf('## ') >= 0;     // Also detect documents with h2 headers (common in task conversion)
          
          setIsMarkdown(detectMarkdown);
        }
        
        // If document was created from task conversion, auto-switch to view mode
        if (doc.source === 'task-conversion') {
          setIsViewMode(true);
          // For Markdown content in edit mode, will need it as HTML
          if (doc.isMarkdown || detectMarkdown) {
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
          isMarkdown: doc.isMarkdown || detectMarkdown,
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
          
          console.log("HTML TO CONVERT TO MARKDOWN:", html);
          
          // Check if this is our special pre-formatted markdown content
          if (html.includes('<pre class="markdown-editor"') || html.includes('<pre style="white-space: pre-wrap; font-family: monospace;">')) {
            // Extract content from pre tag - more robust matching
            const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
            if (preMatch && preMatch[1]) {
              // This is pre-formatted markdown - decode HTML entities and ensure line breaks are preserved
              let extractedContent = preMatch[1]
                .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> back to newlines
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/\r\n/g, '\n') // Normalize Windows line breaks
                .replace(/\r/g, '\n');  // Normalize old Mac line breaks
              
              // Ensure consistent line breaks for task lists
              extractedContent = extractedContent
                .replace(/^- \[ \]/gm, '- [ ]') // Ensure space consistency in unchecked tasks
                .replace(/^- \[x\]/gm, '- [x]') // Ensure space consistency in checked tasks
                .replace(/\n{3,}/g, '\n\n');    // Avoid excessive line breaks
              
              console.log("Extracted pre-formatted markdown:", extractedContent);
              return extractedContent;
            }
          }
          
          // Use a simpler regex-based approach but with careful ordering
          let md = html;
          
          // First, preserve checkboxes by converting them to placeholders
          md = md.replace(/<input[^>]*type="checkbox"[^>]*checked[^>]*>/gi, '__CHECKED_BOX__');
          md = md.replace(/<input[^>]*type="checkbox"[^>]*>/gi, '__UNCHECKED_BOX__');
          
          // Process headings (need to be handled first since they're distinct)
          md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n');
          md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n');
          md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n');
          md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n\n');
          md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n\n');
          md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n\n');
          
          // Process lists carefully - one item at a time
          md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (match, content) => {
            // Check if this list item contained a checkbox
            if (content.includes('__CHECKED_BOX__')) {
              return '\n- [x] ' + content.replace('__CHECKED_BOX__', '').trim() + '\n';
            } else if (content.includes('__UNCHECKED_BOX__')) {
              return '\n- [ ] ' + content.replace('__UNCHECKED_BOX__', '').trim() + '\n';
            } else {
              return '\n- ' + content.trim() + '\n';
            }
          });
          
          // Process paragraphs with care for line breaks
          md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
          
          // Handle text formatting
          md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
          md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
          md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
          md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
          
          // Handle breaks
          md = md.replace(/<br[^>]*>/gi, '\n');
          
          // Remove any remaining HTML tags
          md = md.replace(/<[^>]*>/g, '');
          
          // Fix spacing issues
          md = md
            // Fix excessive newlines
            .replace(/\n{3,}/g, '\n\n')
            // Trim leading/trailing whitespace
            .trim();
            
          console.log("CONVERTED MARKDOWN:", md);
          
          // Console log only for debugging
          console.log("CONVERTED MARKDOWN FOR SAVING:", md);
          
          return md;
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

  // Debug function - only logs to console
  const debugHTMLToMarkdown = (html) => {
    try {
      console.log("HTML SOURCE FOR DEBUGGING:", html);
    } catch (err) {
      console.error("Error in debug function:", err);
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
        
        // Debug the HTML content
        console.log("TOGGLING TO VIEW MODE - HTML CONTENT:", htmlContent);
        debugHTMLToMarkdown(htmlContent);
        
        if (currentIsMarkdown) {
          // For Markdown documents, we need to convert editor's HTML to Markdown
          const convertHtml = (html) => {
            if (!html) return '';
            
            console.log("HTML TO CONVERT TO MARKDOWN:", html);
            
            // Check if this is our special pre-formatted markdown content
            if (html.includes('<pre class="markdown-editor"') || html.includes('<pre style="white-space: pre-wrap; font-family: monospace;">')) {
              // Extract content from pre tag - more robust matching
              const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
              if (preMatch && preMatch[1]) {
                // This is pre-formatted markdown - decode HTML entities and ensure line breaks are preserved
                let extractedContent = preMatch[1]
                  .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> back to newlines
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&amp;/g, '&')
                  .replace(/\r\n/g, '\n') // Normalize Windows line breaks
                  .replace(/\r/g, '\n');  // Normalize old Mac line breaks
                
                // Ensure consistent line breaks for task lists
                extractedContent = extractedContent
                  .replace(/^- \[ \]/gm, '- [ ]') // Ensure space consistency in unchecked tasks
                  .replace(/^- \[x\]/gm, '- [x]') // Ensure space consistency in checked tasks
                  .replace(/\n{3,}/g, '\n\n');    // Avoid excessive line breaks
                
                console.log("Extracted pre-formatted markdown:", extractedContent);
                return extractedContent;
              }
            }
            
            // Use a simpler regex-based approach but with careful ordering
            let md = html;
            
            // First, preserve checkboxes by converting them to placeholders
            md = md.replace(/<input[^>]*type="checkbox"[^>]*checked[^>]*>/gi, '__CHECKED_BOX__');
            md = md.replace(/<input[^>]*type="checkbox"[^>]*>/gi, '__UNCHECKED_BOX__');
            
            // First, handle the critical case when all content is in a single paragraph
            if (md.match(/<p>\s*#\s+.*<\/p>/s)) {
              // Handle the case where the entire markdown content is in a single paragraph
              // First, restore line breaks in markdown syntax
              md = md.replace(/<p>([\s\S]*?)<\/p>/gi, function(match, content) {
                // Replace markdown line breaks with actual newlines
                let fixedContent = content
                  .replace(/\s*#\s+/g, '\n\n# ')                   // Add newlines before headings
                  .replace(/\s*##\s+/g, '\n\n## ')                 // Add newlines before h2 
                  .replace(/\s*###\s+/g, '\n\n### ')               // Add newlines before h3
                  .replace(/\s*####\s+/g, '\n\n#### ')             // Add newlines before h4
                  .replace(/\s*-\s+\[\s*\]\s*/g, '\n\n- [ ] ')     // Add newlines before unchecked boxes
                  .replace(/\s*-\s+\[x\]\s*/g, '\n\n- [x] ')       // Add newlines before checked boxes
                  .replace(/\s*\*([^*]*)\*/g, '\n\n*$1*')          // Add newlines before italic text
                  .trim();
                return fixedContent;
              });
            } else {
              // Regular process for headings if they're already properly formatted
              md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
              md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
              md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
              md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
              md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
              md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');
            }
            
            // Process lists carefully - one item at a time
            md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (match, content) => {
              // Check if this list item contained a checkbox
              if (content.includes('__CHECKED_BOX__')) {
                // Additional safeguards for task list items
                let taskText = content.replace(/\s*__CHECKED_BOX__\s*/g, '').trim();
                // Make sure we have extra line breaks for each task
                return '\n- [x] ' + taskText + '\n\n';
              } else if (content.includes('__UNCHECKED_BOX__')) {
                // Additional safeguards for task list items
                let taskText = content.replace(/\s*__UNCHECKED_BOX__\s*/g, '').trim();
                // Make sure we have extra line breaks for each task
                return '\n- [ ] ' + taskText + '\n\n';
              } else {
                // Regular list item
                return '\n- ' + content.trim() + '\n';
              }
            });
            
            // Process paragraphs with care for line breaks
            md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
            
            // Handle text formatting
            md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
            md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
            md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
            md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
            
            // Handle breaks
            md = md.replace(/<br[^>]*>/gi, '\n');
            
            // Remove any remaining HTML tags
            md = md.replace(/<[^>]*>/g, '');
            
            // Handle Markdown that's all on one line case (critical fix)
            if (!md.includes('\n\n') && md.includes('# ')) {
              // This is likely markdown content all on a single line
              // Insert proper line breaks at key markdown syntax points
              md = md
                .replace(/# /g, '\n\n# ')
                .replace(/## /g, '\n\n## ')
                .replace(/### /g, '\n\n### ')
                .replace(/\- \[ \]/g, '\n\n- [ ]')
                .replace(/\- \[x\]/g, '\n\n- [x]')
                .replace(/\*\*/g, '**');  // Make sure bold stays intact
            }
            
            // Fix spacing issues
            md = md
              // Fix excessive newlines while preserving structure
              .replace(/\n{4,}/g, '\n\n\n')
              // Double-ensure task list items have proper spacing
              .replace(/(- \[[x ]\][^\n]*)(\n)(- \[[x ]\])/g, '$1\n\n$3')
              // Ensure paragraphs have double line breaks
              .replace(/([^\n])\n([^\n])/g, '$1\n\n$2')
              // Trim leading/trailing whitespace
              .trim();
              
            console.log("CONVERTED MARKDOWN:", md);
            
            return md;
          };
          
          // Convert HTML to Markdown for viewing
          const markdownContent = convertHtml(htmlContent);
          
          // Debug the converted markdown to console only
          console.log("FINAL MARKDOWN CONTENT:", markdownContent);
          
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
                  if (latestDoc.isMarkdown || latestDoc.source === 'task-conversion' || currentIsMarkdown) {
                    // For markdown documents, use our special markdown editor mode
                    // First normalize the line breaks
                    const normalizedContent = latestDoc.content
                      .replace(/\r\n/g, '\n')  // Convert Windows line breaks
                      .replace(/\r/g, '\n')    // Convert old Mac line breaks
                      .replace(/\n{3,}/g, '\n\n'); // Limit excessive line breaks
                    
                    // Create the special pre-formatted editor for markdown
                    const formattedHtml = `<pre class="markdown-editor" contenteditable="true" style="white-space: pre-wrap; font-family: monospace; padding: 10px; background: #f8f9fa; border: none; outline: none; width: 100%; height: 100%; overflow: auto; line-height: 1.5;">${normalizedContent
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')}</pre>
                      <div style="font-size: 11px; color: #6c757d; padding: 5px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Markdown editor mode</div>`;
                    
                    // Set raw HTML content to bypass TinyMCE parsing
                    editorRef.current.getBody().innerHTML = formattedHtml;
                    setEditorContent(formattedHtml);
                    
                    // Add a class to the editor content to mark it as markdown in pre format
                    setTimeout(() => {
                      if (editorRef.current) {
                        const editorBody = editorRef.current.getBody();
                        if (editorBody) {
                          editorBody.classList.add('markdown-pre-format');
                          // Disable TinyMCE complex formatting features
                          editorRef.current.getDoc().execCommand('styleWithCSS', false, false);
                        }
                      }
                    }, 100);
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
                  if (currentIsMarkdown || currentSourceContent.indexOf('##') >= 0) {
                    // For markdown documents, use our special markdown editor mode
                    // First normalize the line breaks
                    const normalizedContent = currentSourceContent
                      .replace(/\r\n/g, '\n')  // Convert Windows line breaks
                      .replace(/\r/g, '\n')    // Convert old Mac line breaks
                      .replace(/\n{3,}/g, '\n\n'); // Limit excessive line breaks
                    
                    // Create the special pre-formatted editor for markdown
                    const formattedHtml = `<pre class="markdown-editor" contenteditable="true" style="white-space: pre-wrap; font-family: monospace; padding: 10px; background: #f8f9fa; border: none; outline: none; width: 100%; height: 100%; overflow: auto; line-height: 1.5;">${normalizedContent
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')}</pre>
                      <div style="font-size: 11px; color: #6c757d; padding: 5px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Markdown editor mode</div>`;
                    
                    // Set raw HTML content to bypass TinyMCE parsing
                    editorRef.current.getBody().innerHTML = formattedHtml;
                    setEditorContent(formattedHtml);
                    
                    // Add a class to the editor content to mark it as markdown in pre format
                    setTimeout(() => {
                      if (editorRef.current) {
                        const editorBody = editorRef.current.getBody();
                        if (editorBody) {
                          editorBody.classList.add('markdown-pre-format');
                          // Disable TinyMCE complex formatting features
                          editorRef.current.getDoc().execCommand('styleWithCSS', false, false);
                        }
                      }
                    }, 100);
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
                  // For markdown documents, use our special markdown editor mode
                  // First normalize the line breaks
                  const normalizedContent = currentSourceContent
                    .replace(/\r\n/g, '\n')  // Convert Windows line breaks
                    .replace(/\r/g, '\n')    // Convert old Mac line breaks
                    .replace(/\n{3,}/g, '\n\n'); // Limit excessive line breaks
                  
                  // Create the special pre-formatted editor for markdown
                  const formattedHtml = `<pre class="markdown-editor" contenteditable="true" style="white-space: pre-wrap; font-family: monospace; padding: 10px; background: #f8f9fa; border: none; outline: none; width: 100%; height: 100%; overflow: auto; line-height: 1.5;">${normalizedContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')}</pre>
                    <div style="font-size: 11px; color: #6c757d; padding: 5px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Markdown editor mode</div>`;
                  
                  // Set raw HTML content to bypass TinyMCE parsing
                  editorRef.current.getBody().innerHTML = formattedHtml;
                  setEditorContent(formattedHtml);
                  
                  // Add a class to the editor content to mark it as markdown in pre format
                  setTimeout(() => {
                    if (editorRef.current) {
                      const editorBody = editorRef.current.getBody();
                      if (editorBody) {
                        editorBody.classList.add('markdown-pre-format');
                        // Disable TinyMCE complex formatting features
                        editorRef.current.getDoc().execCommand('styleWithCSS', false, false);
                      }
                    }
                  }, 100);
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
                // For markdown documents, use our special markdown editor mode
                // First normalize the line breaks
                const normalizedContent = currentSourceContent
                  .replace(/\r\n/g, '\n')  // Convert Windows line breaks
                  .replace(/\r/g, '\n')    // Convert old Mac line breaks
                  .replace(/\n{3,}/g, '\n\n'); // Limit excessive line breaks
                
                // Create the special pre-formatted editor for markdown
                const formattedHtml = `<pre class="markdown-editor" contenteditable="true" style="white-space: pre-wrap; font-family: monospace; padding: 10px; background: #f8f9fa; border: none; outline: none; width: 100%; height: 100%; overflow: auto; line-height: 1.5;">${normalizedContent
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')}</pre>
                  <div style="font-size: 11px; color: #6c757d; padding: 5px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Markdown editor mode</div>`;
                
                // Set raw HTML content to bypass TinyMCE parsing
                editorRef.current.getBody().innerHTML = formattedHtml;
                setEditorContent(formattedHtml);
                
                // Add a class to the editor content to mark it as markdown in pre format
                setTimeout(() => {
                  if (editorRef.current) {
                    const editorBody = editorRef.current.getBody();
                    if (editorBody) {
                      editorBody.classList.add('markdown-pre-format');
                      // Disable TinyMCE complex formatting features
                      editorRef.current.getDoc().execCommand('styleWithCSS', false, false);
                    }
                  }
                }, 100);
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
    
    try {
      // Log the original markdown content for debugging
      console.log("ORIGINAL MARKDOWN CONTENT:", sourceContent);
      
      // Configure marked with better defaults
      marked.setOptions({
        gfm: true,           // GitHub Flavored Markdown
        breaks: true,        // Add <br> on single line breaks
        smartLists: true,    // Better list handling
        headerIds: false,    // Don't add IDs to headers
        mangle: false,       // Don't mangle email addresses
      });
      
      // Use a more direct rendering approach with minimal post-processing
      let htmlContent = marked(sourceContent);
      
      // Improved task list handling - catch both list versions and loose versions
      htmlContent = htmlContent
        // Handle task lists in proper list items
        .replace(/<li>\s*\[\s\]\s*(.*?)<\/li>/g, '<li><input type="checkbox" disabled> $1</li>')
        .replace(/<li>\s*\[x\]\s*(.*?)<\/li>/g, '<li><input type="checkbox" checked disabled> $1</li>')
        // Also handle cases where the markdown task list wasn't properly converted to an HTML list
        .replace(/<p>-\s*\[\s\]\s*(.*?)<\/p>/g, '<p><input type="checkbox" disabled> $1</p>')
        .replace(/<p>-\s*\[x\]\s*(.*?)<\/p>/g, '<p><input type="checkbox" checked disabled> $1</p>');
      
      console.log("RENDERED HTML:", htmlContent);
      
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
            apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
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
              plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount linkchecker code',
              toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table | align lineheight | numlist bullist indent outdent | emoticons charmap | removeformat | code',
              content_style: `
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                  font-size: 14px; 
                  color: #1e293b; 
                  white-space: pre-wrap;
                }
                pre {
                  white-space: pre-wrap;
                }
              `,
              // Better handling of line breaks and formatting
              forced_root_block: 'p',  // Use paragraph as root block but with good line break handling
              end_container_on_empty_block: true,
              entity_encoding: 'raw',
              convert_urls: false,
              element_format: 'html',
              keep_styles: true,
              br_newline_selector: '.tinymce-newline',
              // Better list handling
              valid_elements: '*[*]',
              extended_valid_elements: 'li[class|style],ul[class|style],ol[class|style],input[type|checked],pre[*],code[*]',
              // Preserve line breaks in markdown
              protect: [
                /\n/g,  // Protect newlines
              ],
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