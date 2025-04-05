import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  addAIResponse,
  getAIResponses,
  deleteAIResponse,
} from "../services/firebaseConfig";
import { getSynapses, getSynapseContent } from "../services/synapseService";
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
  const location = useLocation();
  const responseContainerRef = useRef(null);

  // Get synapse ID from URL query parameter
  const searchParams = new URLSearchParams(location.search);
  const urlSynapseId = searchParams.get('synapse') || "";

  // States
  const [selectedSynapse, setSelectedSynapse] = useState(urlSynapseId);
  const [synapses, setSynapses] = useState([]);
  const [response, setResponse] = useState("");
  const [savedResponses, setSavedResponses] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState(false);

  const functions = getFunctions();
  const analyzeSynapseContent = httpsCallable(
    functions,
    "analyzeSynapseContent"
  );

  // Load synapses and responses when component mounts
  useEffect(() => {
    if (user && projectId) {
      loadSynapses();
      fetchSavedResponses();
    }
  }, [user, projectId]);

  // Auto-analyze when synapse ID is in URL and synapses are loaded
  useEffect(() => {
    // Log the initial state for debugging 
    console.log("Auto-analyze effect running with:", {
      urlSynapseId,
      "synapses.length": synapses.length,
      hasAutoAnalyzed,
      selectedSynapse
    });
    
    // Only proceed if we have what we need
    if (urlSynapseId && synapses.length > 0 && !hasAutoAnalyzed) {
      console.log('URL contains synapse ID:', urlSynapseId);
      
      // Log all available synapses for debugging
      console.log('Available synapses:');
      synapses.forEach(s => {
        console.log(`- Synapse ID: '${s.id}', Name: '${s.name || "unknown"}', Type: ${typeof s.id}`);
      });
      
      // Check for exact synapse ID match
      let exactMatch = false;
      let matchedSynapse = null;
      
      // Try direct comparison first
      for (const s of synapses) {
        if (s.id === urlSynapseId) {
          exactMatch = true;
          matchedSynapse = s;
          console.log("Found exact match:", s);
          break;
        }
      }
      
      if (matchedSynapse) {
        console.log('Found matching synapse:', matchedSynapse.name || "unnamed");
        
        // Set flag immediately to prevent repeated triggers
        setHasAutoAnalyzed(true);
        
        // Update the selectedSynapse state
        setSelectedSynapse(urlSynapseId);
        
        // Use a longer delay to ensure state has fully updated
        setTimeout(() => {
          console.log('Triggering analysis now');
          
          // Set the selected synapse again right before analyzing (extra safety)
          setSelectedSynapse(urlSynapseId);
          
          // Create a direct function to avoid stale closures
          setTimeout(() => {
            // Define what to do in the scope of this timeout
            console.log("Running actual analysis with selectedSynapse=", selectedSynapse);
            
            // Call analyze directly to avoid React's event loop issues
            (async () => {
              try {
                // Find the synapse again in this scope
                const currentSynapse = synapses.find(s => s.id === urlSynapseId);
                if (!currentSynapse) {
                  console.error("Synapse disappeared from list?");
                  setError("Synapse could not be found");
                  return;
                }
                
                setIsAnalyzing(true);
                
                const synapseData = await getSynapseContent(
                  user.uid,
                  projectId,
                  urlSynapseId
                );
                
                if (!synapseData || !synapseData.contents) {
                  throw new Error("Failed to retrieve synapse content");
                }
                
                const result = await analyzeSynapseContent({
                  synapseContent: synapseData.contents || [],
                  synapseName: currentSynapse.name || "Unnamed Synapse",
                });
                
                let displayedResponse = "";
                for (let i = 0; i < result.data.content.length; i++) {
                  displayedResponse += result.data.content[i];
                  setResponse(displayedResponse);
                  await new Promise(resolve => setTimeout(resolve, 5));
                }
              } catch (error) {
                console.error("Error in auto-analysis:", error);
                setError("Error analyzing synapse: " + error.message);
              } finally {
                setIsAnalyzing(false);
                
                // Remove URL parameter after analysis is done (success or failure)
                navigate(`/project/${projectId}/ai-assistant`, { replace: true });
              }
            })();
          }, 300);
        }, 800);
      } else {
        console.error('Synapse ID from URL not found in loaded synapses after checking all items');
        console.error('URL synapse ID:', urlSynapseId, 'Type:', typeof urlSynapseId);
        console.error('First synapse ID for comparison:', synapses[0]?.id, 'Type:', typeof synapses[0]?.id);
        setError("The requested synapse could not be found. Please select one from the dropdown.");
      }
    }
  // We can't include handleAnalyze in deps as it's defined later
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synapses, urlSynapseId, hasAutoAnalyzed, projectId, navigate]);

  // Load synapses from Firebase
  const loadSynapses = async () => {
    try {
      const fetchedSynapses = await getSynapses(user.uid, projectId);
      setSynapses(fetchedSynapses);
    } catch (error) {
      console.error("Error loading synapses:", error);
      setError("Failed to load synapses");
    }
  };

  // Fetch saved AI responses
  const fetchSavedResponses = async () => {
    try {
      const fetchedResponses = await getAIResponses(user.uid, projectId);
      const synapseResponses = fetchedResponses.filter(
        (r) => r.type === "synapse-analysis"
      );
      setSavedResponses(synapseResponses);
    } catch (error) {
      console.error("Error fetching saved responses:", error);
      setError("Failed to fetch saved ideas");
    }
  };

  // Handle synapse click to navigate to synapse page
  const handleSynapseClick = () => {
    if (selectedSynapse) {
      navigate(`/project/${projectId}/synapses`);
    }
  };

  // Main analyze function with extra safeguards
  const handleAnalyze = async () => {
    console.log("handleAnalyze called with selectedSynapse:", selectedSynapse);
    console.log("Current synapses:", synapses);
    
    if (!selectedSynapse) {
      setError("Please select a synapse to analyze");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Extra debug to see what we're looking for
      console.log(`Looking for synapse with ID '${selectedSynapse}' in ${synapses.length} synapses`);
      
      // Find the synapse with safeguards
      const synapse = synapses.find((s) => s.id === selectedSynapse);
      console.log("Found synapse?", synapse);
      
      if (!synapse) {
        console.error("Selected synapse not found:", selectedSynapse);
        setError("Selected synapse not found");
        setIsAnalyzing(false);
        return;
      }

      // Defensive coding - ensure name property exists
      const synapseName = synapse.name || "Unnamed Synapse";
      console.log("Analyzing synapse:", synapseName);
      
      const synapseData = await getSynapseContent(
        user.uid,
        projectId,
        selectedSynapse
      );
      
      console.log("Got synapse content:", synapseData);
      
      // Check if synapseData and its contents exist
      if (!synapseData || !synapseData.contents) {
        throw new Error("Failed to retrieve synapse content");
      }

      const result = await analyzeSynapseContent({
        synapseContent: synapseData.contents || [],
        synapseName: synapseName,
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

  // Save response to Firebase
  const handleSaveResponse = async () => {
    if (response.trim() === "") return;

    try {
      const synapse = synapses.find((s) => s.id === selectedSynapse);
      const savedResponse = await addAIResponse(
        user.uid,
        projectId,
        response,
        synapse.id,
        synapse.name,
        "synapse-analysis"
      );
      setSavedResponses((prevResponses) => [savedResponse, ...prevResponses]);
      setError(null);
      setResponse("");
      setSelectedSynapse("");
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
              synapse={synapses.find((s) => s.id === selectedSynapse) || null}
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