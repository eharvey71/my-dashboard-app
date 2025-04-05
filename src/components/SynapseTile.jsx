import React from "react";
import { Tag, ExternalLink, AlertTriangle } from "lucide-react";
import styles from "./SynapseTile.module.css";

const SynapseTile = ({ synapse }) => {
  // Guard against undefined synapse
  if (!synapse) {
    return (
      <div className={styles.synapseContainer}>
        <div className={styles.errorState}>
          <AlertTriangle size={20} />
          <span>Synapse data not available</span>
        </div>
      </div>
    );
  }

  // Guard against missing properties
  const synapseName = synapse.name || "Unnamed Synapse";
  const connections = synapse.connections || [];

  return (
    <div className={styles.synapseContainer}>
      <h3 className={styles.synapseTitle}>
        {synapseName}
        <ExternalLink size={16} className={styles.linkIcon} />
      </h3>
      <div className={styles.connectionsList}>
        {connections.length > 0 ? (
          connections.map((connection, index) => (
            <div
              key={connection.itemId || `connection-${index}`}
              className={`${styles.connectionItem} ${
                styles[connection.itemType] || styles.unknown
              }`}
            >
              <Tag size={14} />
              {connection.title || connection.itemId || "Unnamed item"}
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>No connections</div>
        )}
      </div>
    </div>
  );
};

export default SynapseTile;
