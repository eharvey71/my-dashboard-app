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
You are an AI assistant with access to the user's tasks and notes. 
Below is the relevant information from the user's data:

${userContent || "No specific user data found for this query."}

Now, please answer the following question or request from the user:
User: ${input}

Assistant: Let me analyze the information and provide a response based on your tasks and notes.
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
    <div className="ai-assistant">
      <h3>AI Assistant</h3>
      <textarea
        className="form-control mb-3"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask the AI for advice about your tasks and notes..."
      />
      <button
        className="btn btn-outline-secondary mb-3"
        onClick={handleAnalyze}
        disabled={isTyping}
      >
        {isTyping ? "Thinking..." : "Ask GPT"}
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
            minHeight: "100px",
          }}
        />
      </div>
    </div>
  );
};

export default AIAssistant;
