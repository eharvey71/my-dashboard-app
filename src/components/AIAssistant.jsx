import React, { useState, useEffect, useRef } from "react";
import { analyzeContent } from "../services/aiService";
import { queryPinecone } from "../services/pineconeService";

const AIAssistant = ({ user }) => {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const responseRef = useRef(null);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.style.height = "auto";
      responseRef.current.style.height = `${responseRef.current.scrollHeight}px`;
    }
  }, [response]);

  const handleAnalyze = async () => {
    setIsTyping(true);
    setError(null);
    try {
      const userContent = await queryPinecone(user.uid, input);
      const prompt = `
You are an AI assistant with access to the user's tasks, notes, and bookmarked content. 
Below is the relevant information from the user's data:

${userContent || "No specific user data found for this query."}

Now, please answer the following question or request from the user:
User: ${input}

In your response, please:
1. Directly address the user's query.
2. Identify and explain any correlations between tasks, notes, and bookmarked content.
3. Provide insights or suggestions based on the combined information.
4. If relevant, suggest any actions the user might take based on the analyzed information.

A: Certainly! I've analyzed your tasks, notes, and bookmarked content. Here's my response:
`;
      const aiResponse = await analyzeContent(prompt);

      // Simulate typing effect
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

  return (
    <div className="ai-assistant card">
      <div className="card-body">
        <h3 className="card-title">AI Assistant</h3>
        <textarea
          className="form-control mb-3"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your tasks, notes, or bookmarked content..."
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
        <div>
          <h4>Response</h4>
          <textarea
            ref={responseRef}
            className="form-control"
            value={response}
            readOnly
            style={{
              resize: "none",
              overflow: "hidden",
              minHeight: "150px",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;