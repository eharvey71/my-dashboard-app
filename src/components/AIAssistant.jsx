import React, { useState, useEffect, useRef } from "react";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { addAIResponse, getAIResponses } from '../services/firebaseConfig';
import MarkdownRenderer from './MarkdownRenderer';

const AIAssistant = ({ user, projectId }) => {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const responseContainerRef = useRef(null);

  const functions = getFunctions();
  const queryPinecone = httpsCallable(functions, 'queryPinecone');
  const analyzeContent = httpsCallable(functions, 'analyzeContent');

  useEffect(() => {
    if (responseContainerRef.current) {
      responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight;
    }
  }, [response]);

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

      const prompt = `
You are an AI assistant with access to the user's tasks, notes, and bookmarked content for a specific project. 
Below is the relevant information from the user's data for this project:

${userContent || "No specific user data found for this query in the current project."}

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
      setInput("");
    }
  };

  const handleSaveResponse = async () => {
    if (response.trim() === '') return;
    try {
      await addAIResponse(user.uid, projectId, response);
      setError(null);
    } catch (error) {
      console.error("Error saving AI response:", error);
      setError("Failed to save AI response");
    }
  };

  const handleClearResponse = () => {
    setResponse("");
  };

  return (
    <div className="ai-assistant card">
      <div className="card-body">
        <h3 className="card-title">AI Assistant</h3>
        <textarea
          className="form-control mb-3"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your tasks, notes, or bookmarked content for this project..."
          rows="3"
        />
        <button
          className="btn btn-primary mb-3"
          onClick={handleAnalyze}
          disabled={isTyping}
        >
          {isTyping ? "Analyzing..." : "Ask AI Assistant"}
        </button>
        {error && <div className="alert alert-danger">{error}</div>}
        <div ref={responseContainerRef} style={{ maxHeight: "400px", overflowY: "auto" }}>
          <h4>Response</h4>
          <div className="bg-light p-3 rounded">
            <MarkdownRenderer content={response} />
          </div>
        </div>
        <div className="d-flex justify-content-between mt-3">
          <button
            className="btn btn-outline-primary"
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
      </div>
    </div>
  );
};

export default AIAssistant;