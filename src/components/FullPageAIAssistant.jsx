import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  addAIResponse,
  getAIResponses,
  deleteAIResponse,
} from "../services/firebaseConfig";
import { getSynapses, getSynapseContent } from "../services/synapseService"; // Added getSynapseContent
import styles from "./FullPageAIAssistant.module.css";
import {
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Brain,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import SynapseTile from "./SynapseTile";

const AIResponse = ({ response, onDeleteResponse, onToggleInclude }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDeleteClick = () => setIsConfirmingDelete(true);
  const handleCancelDelete = () => setIsConfirmingDelete(false);
  const handleConfirmDelete = async () => {
    await onDeleteResponse(response.id);
    setIsConfirmingDelete(false);
  };
  const toggleExpand = () => setIsExpanded(!isExpanded);

  const truncatedContent =
    response.content.slice(0, 150) +
    (response.content.length > 150 ? "..." : "");

  return (
    <div className={styles.responseCard}>
      <div className={styles.questionContainer}>
        <strong>Synapse: </strong>
        {response.synapseName}
      </div>
      <div
        className={
          isExpanded ? styles.expandedResponse : styles.truncatedResponse
        }
      >
        <MarkdownRenderer
          content={isExpanded ? response.content : truncatedContent}
        />
      </div>
      <button className={styles.expandButton} onClick={toggleExpand}>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        {isExpanded ? "Show Less" : "Show More"}
      </button>
      <div className={styles.responseFooter}>
        <small className={styles.textMuted}>
          {response.createdAt instanceof Date
            ? response.createdAt.toLocaleString()
            : "Invalid Date"}
        </small>
        <div className={styles.responseActions}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={response.included}
              onChange={() => onToggleInclude(response.id)}
            />
            Include in future analysis
          </label>
          <button
            className="btn btn-sm btn-link text-danger"
            onClick={handleDeleteClick}
            title="Delete idea"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      {isConfirmingDelete && (
        <div className={styles.deleteConfirmationOverlay}>
          <div
            className={`${styles.deleteConfirmation} d-flex align-items-center justify-content-center`}
          >
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
  const navigate = useNavigate();
  const { projectId } = useParams();
  const responseContainerRef = useRef(null);

  const [selectedSynapse, setSelectedSynapse] = useState("");
  const [synapses, setSynapses] = useState([]);
  const [response, setResponse] = useState("");
  const [savedResponses, setSavedResponses] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const functions = getFunctions();
  const analyzeSynapseContent = httpsCallable(
    functions,
    "analyzeSynapseContent"
  );

  useEffect(() => {
    if (user && projectId) {
      loadSynapses();
      fetchSavedResponses();
    }
  }, [user, projectId]);

  const loadSynapses = async () => {
    try {
      const fetchedSynapses = await getSynapses(user.uid, projectId);
      setSynapses(fetchedSynapses);
    } catch (error) {
      console.error("Error loading synapses:", error);
      setError("Failed to load synapses");
    }
  };

  const fetchSavedResponses = async () => {
    try {
      const fetchedResponses = await getAIResponses(user.uid, projectId);
      // Filter to only show synapse-related responses
      const synapseResponses = fetchedResponses.filter(
        (r) => r.type === "synapse-analysis"
      );
      setSavedResponses(synapseResponses);
    } catch (error) {
      console.error("Error fetching saved responses:", error);
      setError("Failed to fetch saved ideas");
    }
  };

  const handleSynapseClick = () => {
    if (selectedSynapse) {
      navigate(`/project/${projectId}/synapses`);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedSynapse) {
      setError("Please select a synapse to analyze");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const synapse = synapses.find((s) => s.id === selectedSynapse);
      const synapseData = await getSynapseContent(
        user.uid,
        projectId,
        selectedSynapse
      );

      const result = await analyzeSynapseContent({
        synapseContent: synapseData.contents,
        synapseName: synapse.name,
      });

      let displayedResponse = "";
      for (let i = 0; i < result.data.content.length; i++) {
        displayedResponse += result.data.content[i];
        setResponse(displayedResponse);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    } catch (error) {
      console.error("Error analyzing synapse:", error);
      setError(
        "Sorry, there was an error analyzing this synapse. Please try again."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveResponse = async () => {
    if (response.trim() === "") return;

    try {
      const synapse = synapses.find((s) => s.id === selectedSynapse);
      const savedResponse = await addAIResponse(
        user.uid,
        projectId,
        response,
        synapse.id, // Add synapse ID
        synapse.name,
        "synapse-analysis" // Add type
      );
      setSavedResponses((prevResponses) => [savedResponse, ...prevResponses]);
      setError(null);
      setResponse("");
      setSelectedSynapse(""); // Reset selection after saving
    } catch (error) {
      console.error("Error saving idea:", error);
      setError("Failed to save idea");
    }
  };

  const handleClearResponse = () => setResponse("");

  const handleDeleteResponse = async (id) => {
    try {
      await deleteAIResponse(id);
      setSavedResponses((prevResponses) =>
        prevResponses.filter((response) => response.id !== id)
      );
    } catch (error) {
      console.error("Error deleting idea:", error);
      setError("Failed to delete idea");
    }
  };

  const handleToggleInclude = async (id) => {
    try {
      setSavedResponses((prevResponses) =>
        prevResponses.map((response) =>
          response.id === id
            ? { ...response, included: !response.included }
            : response
        )
      );
    } catch (error) {
      console.error("Error toggling include status:", error);
      setError("Failed to update include status");
    }
  };

  return (
    <div className="container">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-6 w-6" />
        <h1>Synapse Analysis</h1>
      </div>

      <div className="mb-3">
        <select
          className="form-select"
          value={selectedSynapse}
          onChange={(e) => setSelectedSynapse(e.target.value)}
        >
          <option value="">Select a Synapse to Analyze</option>
          {synapses.map((synapse) => (
            <option key={synapse.id} value={synapse.id}>
              {synapse.name}
            </option>
          ))}
        </select>
      </div>

      {/* Synapse Preview */}
      {selectedSynapse && (
        <div className="mb-4">
          <h4 className="mb-2">Selected Synapse</h4>
          <div
            onClick={handleSynapseClick}
            className={styles.clickableSynapse}
            title="Click to view in Synapses"
          >
            <SynapseTile
              synapse={synapses.find((s) => s.id === selectedSynapse)}
            />
          </div>
        </div>
      )}

      <div className="mb-3">
        <button
          className="btn btn-primary mb-3"
          onClick={handleAnalyze}
          disabled={isAnalyzing || !selectedSynapse}
        >
          {isAnalyzing ? (
            <>
              Analyzing... <Zap className="ms-1" size={18} />
            </>
          ) : (
            <>
              Fire a Neuron <Zap className="ms-1" size={18} />
            </>
          )}
        </button>
      </div>

      {error && <p className={styles.textDanger}>{error}</p>}

      {response && (
        <div className={styles.responseSection}>
          <div ref={responseContainerRef} className={styles.responseContainer}>
            <h4 className="mb-2">Analysis</h4>
            <div className={styles.responseContent}>
              <MarkdownRenderer content={response} />
            </div>
          </div>
          <div className="d-flex mb-4 mt-3">
            <button
              className="btn btn-outline-primary me-2"
              onClick={handleSaveResponse}
              disabled={response.trim() === ""}
            >
              Save as Idea
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={handleClearResponse}
              disabled={response.trim() === ""}
            >
              Clear Analysis
            </button>
          </div>
        </div>
      )}

      <h2>Saved Ideas</h2>
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
