import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  addAIResponse,
  getAIResponses,
  deleteAIResponse,
} from "../services/firebaseConfig";
import { getSynapses, getSynapseContent } from "../services/synapseService";
import { useEducation } from "../contexts/EducationContext";
import { useProjectContext } from "../contexts/ProjectContext";
import styles from "./FullPageAIAssistant.module.css";
import {
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Brain,
  Network,
  FileText,
  CheckSquare,
  Bookmark,
  StickyNote,
  Filter,
  Plus,
  Download,
  BarChart4,
  Share2,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import SynapseTile from "./SynapseTile";

// Component for saved AI responses
const AIResponse = ({ response, onDeleteResponse, onToggleInclude, onShare }) => {
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
            className="btn btn-sm btn-link"
            onClick={() => onShare(response)}
            title="Share analysis"
          >
            <Share2 size={18} />
          </button>
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

// Content type icons to display in the synapse content section
const contentTypeIcons = {
  document: <FileText size={16} />,
  task: <CheckSquare size={16} />,
  bookmark: <Bookmark size={16} />,
  note: <StickyNote size={16} />
};

const FullPageAIAssistant = ({ user }) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const location = useLocation();
  const responseContainerRef = useRef(null);
  const { getTerm, educationMode } = useEducation();
  const { activeProjectType } = useProjectContext();

  // Get synapse ID from URL query parameter
  const searchParams = new URLSearchParams(location.search);
  const urlSynapseId = searchParams.get('synapse') || "";

  // States
  const [selectedSynapse, setSelectedSynapse] = useState(urlSynapseId);
  const [synapses, setSynapses] = useState([]);
  const [synapseContents, setSynapseContents] = useState([]);
  const [response, setResponse] = useState("");
  const [savedResponses, setSavedResponses] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState(false);
  const [analysisType, setAnalysisType] = useState("comprehensive");
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [typeFilters, setTypeFilters] = useState({
    document: true,
    task: true,
    bookmark: true,
    note: true
  });
  const [analysisMode, setAnalysisMode] = useState("core");
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [showSynapseContent, setShowSynapseContent] = useState(false);

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
    if (urlSynapseId && synapses.length > 0 && !hasAutoAnalyzed) {
      const matchedSynapse = synapses.find(s => s.id === urlSynapseId);
      
      if (matchedSynapse) {
        setHasAutoAnalyzed(true);
        setSelectedSynapse(urlSynapseId);
        
        setTimeout(() => {
          (async () => {
            try {
              await fetchSynapseContent(urlSynapseId);
              handleAnalyze();
            } catch (error) {
              console.error("Error in auto-analysis:", error);
              setError("Error analyzing synapse: " + error.message);
            } finally {
              navigate(`/project/${projectId}/ai-assistant`, { replace: true });
            }
          })();
        }, 800);
      } else {
        setError("The requested synapse could not be found. Please select one from the dropdown.");
      }
    }
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

  // Fetch synapse content
  const fetchSynapseContent = async (synapseId) => {
    if (!synapseId) return;
    
    try {
      const data = await getSynapseContent(user.uid, projectId, synapseId);
      setSynapseContents(data.contents || []);
      return data.contents || [];
    } catch (error) {
      console.error("Error fetching synapse content:", error);
      setError("Failed to fetch synapse content");
      return [];
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

  // Handle synapse change in dropdown
  const handleSynapseChange = async (e) => {
    const synapseId = e.target.value;
    setSelectedSynapse(synapseId);
    
    if (synapseId) {
      await fetchSynapseContent(synapseId);
      setShowSynapseContent(true);
    } else {
      setSynapseContents([]);
      setShowSynapseContent(false);
    }
  };

  // Handle type filter changes
  const handleTypeFilterChange = (type) => {
    setTypeFilters(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Get filtered content based on type filters
  const getFilteredContent = () => {
    return synapseContents.filter(item => typeFilters[item.type]);
  };

  // Main analyze function
  const handleAnalyze = async () => {
    if (!selectedSynapse) {
      setError("Please select a synapse to analyze");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const synapse = synapses.find((s) => s.id === selectedSynapse);
      
      if (!synapse) {
        setError("Selected synapse not found");
        setIsAnalyzing(false);
        return;
      }

      const synapseName = synapse.name || "Unnamed Synapse";
      
      // Use previously fetched contents or fetch them now if needed
      const filteredContents = getFilteredContent();
      
      if (filteredContents.length === 0) {
        setError("No content to analyze after applying filters");
        setIsAnalyzing(false);
        return;
      }

      // Call Firebase function with appropriate analysis type
      const result = await analyzeSynapseContent({
        synapseContent: filteredContents,
        synapseName: synapseName,
        analysisType: analysisType,
        analysisMode: analysisMode,
        educationMode: educationMode,
        projectType: activeProjectType
      });

      // Display the response with a typing effect
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

  const handleShare = (response) => {
    // For now, just copy to clipboard
    navigator.clipboard.writeText(response.content)
      .then(() => {
        alert("Analysis copied to clipboard!");
      })
      .catch(err => {
        console.error("Error copying to clipboard:", err);
        setError("Failed to copy to clipboard");
      });
  };

  const handleDownload = (format) => {
    if (!response) return;
    
    let content = response;
    let fileExtension = ".md";
    let mimeType = "text/markdown";
    
    if (format === "pdf") {
      // For real implementation, generate PDF using a library
      alert("PDF download would be implemented here");
      return;
    } else if (format === "txt") {
      // For plain text, remove markdown formatting (simplified)
      content = content.replace(/#+\s/g, ""); // Remove headers
      content = content.replace(/\*\*/g, "");  // Remove bold
      content = content.replace(/\*/g, "");    // Remove italic
      fileExtension = ".txt";
      mimeType = "text/plain";
    }
    
    const synapse = synapses.find(s => s.id === selectedSynapse);
    const fileName = `synapse-analysis-${synapse?.name || 'unnamed'}${fileExtension}`;
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setShowDownloadOptions(false);
  };

  // Count content items by type
  const contentTypeCounts = synapseContents.reduce((counts, item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
    return counts;
  }, {});

  return (
    <div className="container">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-2">
          <Brain className="h-6 w-6" />
          <h3>Neural Insights</h3>
        </div>
        
        <div className={styles.tooltipContainer}>
          <div className="alert alert-info p-3 mb-0">
            <strong>How to analyze your synapse:</strong>
            <ul className="mb-0 mt-2">
              <li><strong>Select a synapse</strong> from the dropdown</li>
              <li><strong>Choose an analysis type</strong> based on the insights you need</li>
              <li><strong>Select a processing mode</strong>: Core (factual), Enhanced (deeper insights), or Creative (innovative perspectives)</li>
              <li><strong>Click "Analyze Synapse"</strong> to generate your analysis</li>
              <li><strong>Save</strong> useful analyses to reference later</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Synapse Selection */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Select Synapse to Analyze</h5>
          <div className="row">
            <div className="col-md-8">
              <select
                className="form-select"
                value={selectedSynapse}
                onChange={handleSynapseChange}
              >
                <option value="">Select a Synapse</option>
                {synapses.map((synapse) => (
                  <option key={synapse.id} value={synapse.id}>
                    {synapse.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4 mt-2 mt-md-0">
              <button 
                className={`btn ${showSynapseContent ? 'btn-secondary' : 'btn-outline-secondary'} w-100`}
                onClick={() => setShowSynapseContent(!showSynapseContent)}
                disabled={synapseContents.length === 0}
              >
                {showSynapseContent ? 'Hide Content' : 'Show Content'} 
                {synapseContents.length > 0 && <span className="ms-1 badge bg-light text-dark">{synapseContents.length}</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Synapse Content Preview */}
      {showSynapseContent && synapseContents.length > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between mb-3">
              <h5 className="card-title mb-0">Synapse Content</h5>
              <div>
                <button
                  className="btn btn-sm btn-outline-secondary me-2"
                  onClick={() => setShowTypeFilter(!showTypeFilter)}
                >
                  <Filter size={16} className="me-1" /> Filter
                </button>
                {showTypeFilter && (
                  <div className={styles.filterDropdown}>
                    {Object.keys(typeFilters).map(type => (
                      <div key={type} className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`filter-${type}`}
                          checked={typeFilters[type]}
                          onChange={() => handleTypeFilterChange(type)}
                        />
                        <label className="form-check-label" htmlFor={`filter-${type}`}>
                          <span className="d-flex align-items-center">
                            {contentTypeIcons[type]}
                            <span className="ms-1">{type.charAt(0).toUpperCase() + type.slice(1)}s</span>
                            {contentTypeCounts[type] && <span className="ms-1 badge bg-light text-dark">{contentTypeCounts[type]}</span>}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.synapseContentGrid}>
              {synapseContents
                .filter(item => typeFilters[item.type])
                .map((item, index) => (
                  <div key={`${item.id}-${index}`} className={`${styles.contentItem} ${styles[item.type]}`}>
                    <div className={styles.contentTypeIcon}>
                      {contentTypeIcons[item.type]}
                    </div>
                    <div className={styles.contentTitle}>
                      {item.title || item.content.substring(0, 40) + (item.content.length > 40 ? '...' : '')}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Analysis Options */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Analysis Options</h5>
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">Analysis Type</label>
                <select
                  className="form-select"
                  value={analysisType}
                  onChange={(e) => setAnalysisType(e.target.value)}
                  title={`Choose what kind of analysis you want the AI to perform on your ${getTerm("synapse").toLowerCase()} content`}
                >
                  <option value="comprehensive" title={`A thorough analysis of all content within the ${getTerm("synapse").toLowerCase()}, identifying patterns, themes, and insights across all materials`}>
                    {educationMode ? "Comprehensive Study Analysis" : "Comprehensive Analysis"}
                  </option>
                  <option value="relationships" title={`Focuses on identifying connections, similarities, and contradictions between different pieces of content in your ${getTerm("synapse").toLowerCase()}`}>
                    {educationMode ? "Concept Relationships" : "Relationship-Focused"}
                  </option>
                  <option value="summary" title={`A concise overview that extracts the most essential information from all content in your ${getTerm("synapse").toLowerCase()}`}>
                    {educationMode ? "Study Summary" : "Executive Summary"}
                  </option>
                  <option value="actionItems" title={`Identifies concrete next steps, ${getTerm("tasks", activeProjectType).toLowerCase()}, and actionable insights from your ${getTerm("synapse").toLowerCase()} content`}>
                    {educationMode ? "Study Action Items" : "Action Items Extraction"}
                  </option>
                  <option value="timeline" title={`Organizes content chronologically to show the development or sequence of information in your ${getTerm("synapse").toLowerCase()}`}>
                    {educationMode ? "Course Timeline" : "Timeline Analysis"}
                  </option>
                  <option value="learningPlan" title={`Creates a structured learning guide with resources, steps, and milestones based on your ${getTerm("synapse").toLowerCase()} content`}>
                    {educationMode ? "Study Guide & Learning Plan" : "Learning Plan/Study Guide"}
                  </option>
                </select>
              </div>
            </div>
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">Analysis Mode</label>
                <div className="d-flex flex-column">
                  <div className="d-flex mb-2">
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="analysisMode"
                        id="analysisMode1"
                        value="core"
                        checked={analysisMode === "core"}
                        onChange={() => setAnalysisMode("core")}
                      />
                      <label className="form-check-label" htmlFor="analysisMode1" title="Focuses strictly on the content provided without additional interpretation or creativity">
                        Core Only
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="analysisMode"
                        id="analysisMode2"
                        value="expanded"
                        checked={analysisMode === "expanded"}
                        onChange={() => setAnalysisMode("expanded")}
                      />
                      <label className="form-check-label" htmlFor="analysisMode2" title="Offers deeper insights and connections beyond what's explicitly stated in the content">
                        Enhanced
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="analysisMode"
                        id="analysisMode3"
                        value="creative"
                        checked={analysisMode === "creative"}
                        onChange={() => setAnalysisMode("creative")}
                      />
                      <label className="form-check-label" htmlFor="analysisMode3" title="Provides innovative perspectives, metaphors, and creative approaches to analyzing your content">
                        Creative
                      </label>
                    </div>
                  </div>
                  <div className={styles.modeDescription}>
                    {analysisMode === "core" && (
                      <small className="text-muted">
                        <strong>Core Only:</strong> Focuses strictly on the facts and information explicitly present in your synapse content. Provides a straightforward analysis without additional interpretation.
                      </small>
                    )}
                    {analysisMode === "expanded" && (
                      <small className="text-muted">
                        <strong>Enhanced:</strong> Provides deeper analysis with additional context, insights, and connections that may not be explicitly stated in your content. Includes more detailed explanations.
                      </small>
                    )}
                    {analysisMode === "creative" && (
                      <small className="text-muted">
                        <strong>Creative:</strong> Offers innovative perspectives, metaphors, and creative approaches to analyzing your content. Includes novel ideas and connections to enhance understanding.
                      </small>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
              <button
                className="btn btn-primary"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !selectedSynapse || synapseContents.length === 0}
              >
                {isAnalyzing ? (
                  <>
                    Analyzing... <Zap className="ms-1" size={18} />
                  </>
                ) : (
                  <>
                    Fire Neuron <Zap className="ms-1" size={18} />
                  </>
                )}
              </button>
              
              {!isAnalyzing && selectedSynapse && synapseContents.length > 0 && (
                <div className={`ms-3 ${styles.analysisDescription}`}>
                  {analysisType === "comprehensive" && (
                    <small>Will perform a thorough analysis of all your synapse content</small>
                  )}
                  {analysisType === "relationships" && (
                    <small>Will identify connections and relationships between your synapse items</small>
                  )}
                  {analysisType === "summary" && (
                    <small>Will create a concise summary of your entire synapse content</small>
                  )}
                  {analysisType === "actionItems" && (
                    <small>Will extract concrete next steps and {getTerm("tasks", activeProjectType).toLowerCase()} from your synapse</small>
                  )}
                  {analysisType === "timeline" && (
                    <small>Will organize your content to show chronological sequence and development</small>
                  )}
                  {analysisType === "learningPlan" && (
                    <small>Will create a structured learning guide with resources and milestones</small>
                  )}
                </div>
              )}
            </div>
            
            <div className={styles.buttonGroup}>
              <button 
                className="btn btn-outline-primary"
                onClick={() => navigate(`/project/${projectId}/synapses`)}
              >
                <Network size={16} className="me-1" /> 
                View Synapses
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Analysis Results */}
      {response && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between mb-3">
              <h5 className="card-title">Analysis Results</h5>
              <div className={styles.actionButtons}>
                <div className={styles.dropdownContainer}>
                  <button 
                    className="btn btn-sm btn-outline-secondary me-2"
                    onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                  >
                    <Download size={16} className="me-1" /> Export
                  </button>
                  {showDownloadOptions && (
                    <div className={styles.downloadDropdown}>
                      <button 
                        className={styles.downloadOption}
                        onClick={() => handleDownload('md')}
                      >
                        Markdown (.md)
                      </button>
                      <button 
                        className={styles.downloadOption}
                        onClick={() => handleDownload('txt')}
                      >
                        Plain Text (.txt)
                      </button>
                      <button 
                        className={styles.downloadOption}
                        onClick={() => handleDownload('pdf')}
                      >
                        PDF Document
                      </button>
                    </div>
                  )}
                </div>
                <button 
                  className="btn btn-sm btn-primary"
                  onClick={handleSaveResponse}
                >
                  <Plus size={16} className="me-1" /> Save Analysis
                </button>
              </div>
            </div>
            
            <div ref={responseContainerRef} className={styles.responseContainer}>
              <div className={styles.responseContent}>
                <MarkdownRenderer content={response} />
              </div>
            </div>
            
            <div className="d-flex mt-3">
              <button
                className="btn btn-outline-secondary"
                onClick={handleClearResponse}
              >
                Clear Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Analysis Section */}
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between">
            <h5 className="card-title">
              <BarChart4 size={18} className="me-2" />
              Saved Analyses
            </h5>
          </div>
          
          <div className={styles.responsesGrid}>
            {savedResponses.length > 0 ? (
              savedResponses.map((response) => (
                <AIResponse
                  key={response.id}
                  response={response}
                  onDeleteResponse={handleDeleteResponse}
                  onToggleInclude={handleToggleInclude}
                  onShare={handleShare}
                />
              ))
            ) : (
              <div className="alert alert-info">
                No saved analyses yet. Analyze a synapse and save the results to see them here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullPageAIAssistant;