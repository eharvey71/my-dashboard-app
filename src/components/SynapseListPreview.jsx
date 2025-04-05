import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSynapses } from '../services/synapseService';
import SynapseTile from './SynapseTile';
import styles from './SynapseListPreview.module.css';
import { Zap, Plus, Brain } from 'lucide-react';

const SynapseListPreview = ({ user, projectId, limit = 3 }) => {
  const [synapses, setSynapses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSynapses = async () => {
      if (!user || !projectId) return;
      
      try {
        setLoading(true);
        const fetchedSynapses = await getSynapses(user.uid, projectId);
        setSynapses(fetchedSynapses.slice(0, limit));
      } catch (err) {
        console.error('Error fetching synapses:', err);
        setError('Failed to load synapses');
      } finally {
        setLoading(false);
      }
    };

    fetchSynapses();
  }, [user, projectId, limit]);

  const handleSynapseClick = (synapseId) => {
    navigate(`/project/${projectId}/synapses`);
  };

  const handleAnalyzeClick = (synapseId, e) => {
    e.stopPropagation(); // Prevent triggering the parent click
    
    // Let's set a URL parameter and use a simpler approach that doesn't rely on state
    const searchParams = new URLSearchParams();
    searchParams.set('synapse', synapseId);
    
    navigate(`/project/${projectId}/ai-assistant?${searchParams.toString()}`);
  };

  const handleAddSynapse = () => {
    navigate(`/project/${projectId}/synapses`);
  };

  if (loading) return <div className={styles.loading}>Loading synapses...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Brain size={20} />
          <span>Synapses</span>
        </h2>
        <button 
          className={styles.viewAllButton}
          onClick={() => navigate(`/project/${projectId}/synapses`)}
        >
          View All
        </button>
      </div>

      {synapses.length > 0 ? (
        <div className={styles.synapsesList}>
          {synapses.map(synapse => (
            <div key={synapse.id} className={styles.synapseWrapper}>
              <div 
                className={styles.clickableContainer}
                onClick={() => handleSynapseClick(synapse.id)}
              >
                <SynapseTile synapse={synapse} />
              </div>
              <button 
                className={styles.analyzeButton}
                onClick={(e) => handleAnalyzeClick(synapse.id, e)}
                title="Fire a Neuron"
              >
                <Zap size={16} />
                Fire Neuron
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No synapses yet</p>
          <button 
            className={styles.addButton}
            onClick={handleAddSynapse}
          >
            <Plus size={16} />
            Create Synapse
          </button>
        </div>
      )}
    </div>
  );
};

export default SynapseListPreview;