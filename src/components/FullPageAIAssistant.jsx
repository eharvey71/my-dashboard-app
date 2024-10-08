import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { addAIResponse, getAIResponses, deleteAIResponse } from '../services/firebaseConfig';
import styles from './FullPageAIAssistant.module.css';
import { Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

const AIResponse = ({ response, onDeleteResponse, onToggleInclude }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDeleteClick = () => {
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = async () => {
    await onDeleteResponse(response.id);
    setIsConfirmingDelete(false);
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const truncatedContent = response.content.slice(0, 150) + (response.content.length > 150 ? '...' : '');

  return (
    <div className={styles.responseCard}>
      <div className={styles.questionContainer}>
        <strong>Q: </strong>{response.question}
      </div>
      <div className={isExpanded ? styles.expandedResponse : styles.truncatedResponse}>
        <MarkdownRenderer content={isExpanded ? response.content : truncatedContent} />
      </div>
      <button className={styles.expandButton} onClick={toggleExpand}>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        {isExpanded ? 'Show Less' : 'Show More'}
      </button>
      <div className={styles.responseFooter}>
        <small className={styles.textMuted}>
          {response.createdAt instanceof Date ? response.createdAt.toLocaleString() : 'Invalid Date'}
        </small>
        <div className={styles.responseActions}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={response.included}
              onChange={() => onToggleInclude(response.id)}
            />
            Include in future queries
          </label>
          <button
            className="btn btn-sm btn-link text-danger"
            onClick={handleDeleteClick}
            title="Delete response"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      {isConfirmingDelete && (
        <div className={styles.deleteConfirmationOverlay}>
          <div className={`${styles.deleteConfirmation} d-flex align-items-center justify-content-center`}>
            <span className="me-2">Confirm delete?</span>
            <button
              className="btn btn-sm btn-success me-1"
              onClick={handleConfirmDelete}
              title="Confirm delete"
            >
              <Check size={14} />
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={handleCancelDelete}
              title="Cancel delete"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const FullPageAIAssistant = ({ user }) => {
  const { projectId } = useParams();
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [savedResponses, setSavedResponses] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const responseContainerRef = useRef(null);

  const functions = getFunctions();
  const queryPinecone = httpsCallable(functions, 'queryPinecone');
  const analyzeContent = httpsCallable(functions, 'analyzeContent');

  useEffect(() => {
    if (user && projectId) {
      fetchSavedResponses();
    }
  }, [user, projectId]);

  //useEffect(() => {
  //  if (responseContainerRef.current) {
  //    responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight;
  //  }
  //}, [response]);

  const fetchSavedResponses = async () => {
    try {
      const fetchedResponses = await getAIResponses(user.uid, projectId);
      setSavedResponses(fetchedResponses);
    } catch (error) {
      console.error("Error fetching saved responses:", error);
      setError("Failed to fetch saved responses");
    }
  };

  const handleAnalyze = async () => {
    setIsTyping(true);
    setError(null);
    try {
      const userContentResult = await queryPinecone({ 
        query: input, 
        userId: user.uid, 
        projectId: projectId 
      });
      const userContent = userContentResult.data.relevantContent;

      const includedResponses = savedResponses
        .filter(response => response.included)
        .map(response => response.content)
        .join('\n\n');

      const prompt = `
You are an AI assistant with access to the user's tasks, notes, and bookmarked content for a specific project. 
Below is the relevant information from the user's data for this project:

${userContent || "No specific user data found for this query in the current project."}

Previously saved and included responses:
${includedResponses || "No previously saved responses are included."}

Now, please answer the following question or request from the user:
User: ${input}

In your response, please:
1. Directly address the user's query.
2. Identify and explain any correlations between tasks, notes, and bookmarked content within this project.
3. Provide insights or suggestions based on the combined information for this project.
4. If relevant, suggest any actions the user might take based on the analyzed information within the project scope.
5. For tasks, consider their priorities (if available) when providing recommendations or insights.

Remember to focus only on the information related to the current project.

A: Certainly! I've analyzed your tasks (including their priorities), notes, and bookmarked content for this specific project. Here's my response:
`;

      const aiResponseResult = await analyzeContent({ prompt });
      const aiResponse = aiResponseResult.data.content;

      let displayedResponse = '';
      for (let i = 0; i < aiResponse.length; i++) {
        displayedResponse += aiResponse[i];
        setResponse(displayedResponse);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      setError(
        "Sorry, there was an error processing your request. Please try again."
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleSaveResponse = async () => {
    if (response.trim() === '') return;
    try {
      const savedResponse = await addAIResponse(user.uid, projectId, response, input);
      setSavedResponses(prevResponses => [savedResponse, ...prevResponses]);
      setError(null);
      setInput("");
      setResponse("");
    } catch (error) {
      console.error("Error saving AI response:", error);
      setError("Failed to save AI response");
    }
  };

  const handleClearResponse = () => {
    setResponse("");
  };

  const handleDeleteResponse = async (id) => {
    try {
      await deleteAIResponse(id);
      setSavedResponses(prevResponses => prevResponses.filter(response => response.id !== id));
    } catch (error) {
      console.error("Error deleting AI response:", error);
      setError("Failed to delete AI response");
    }
  };

  const handleToggleInclude = async (id) => {
    try {
      const updatedResponses = savedResponses.map(response =>
        response.id === id ? { ...response, included: !response.included } : response
      );
      setSavedResponses(updatedResponses);
      // You might want to update this in your database as well
    } catch (error) {
      console.error("Error toggling include status:", error);
      setError("Failed to update include status");
    }
  };

  return (
    <div className="container">
      <h1>AI Assistant</h1>
      <div className="mb-3">
        <textarea
          className="form-control"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your tasks, notes, or bookmarked content for this project..."
          rows="3"
        />
      </div>
      <button
        className="btn btn-primary mb-3"
        onClick={handleAnalyze}
        disabled={isTyping}
      >
        {isTyping ? "Analyzing..." : "Ask AI Assistant"}
      </button>
      {error && <p className={styles.textDanger}>{error}</p>}
      <div ref={responseContainerRef} className={styles.responseContainer}>
        <h4>Response</h4>
        <MarkdownRenderer content={response} />
      </div>
      <div className="d-flex mb-4">
        <button
          className="btn btn-outline-primary me-2"
          onClick={handleSaveResponse}
          disabled={response.trim() === ''}
        >
          Save Response
        </button>
        <button
          className="btn btn-outline-secondary"
          onClick={handleClearResponse}
          disabled={response.trim() === ''}
        >
          Clear Response
        </button>
      </div>
      <h2>Saved Responses</h2>
      <div className={styles.responsesGrid}>
        {savedResponses.map((response) => (
          <AIResponse 
            key={response.id} 
            response={response} 
            onDeleteResponse={handleDeleteResponse}
            onToggleInclude={handleToggleInclude}
          />
        ))}
      </div>
    </div>
  );
};

export default FullPageAIAssistant;