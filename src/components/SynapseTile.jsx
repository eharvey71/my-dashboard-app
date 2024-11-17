import React from "react";
import { Tag, ExternalLink } from "lucide-react";
import styles from "./SynapseTile.module.css"; // Add CSS module import

const SynapseTile = ({ synapse }) => {
  return (
    <div className={styles.synapseContainer}>
      <h3 className={styles.synapseTitle}>
        {synapse.name}
        <ExternalLink size={16} className={styles.linkIcon} />
      </h3>
      <div className={styles.connectionsList}>
        {synapse.connections.map((connection) => (
          <div
            key={`${connection.itemId}`}
            className={`${styles.connectionItem} ${
              styles[connection.itemType]
            }`}
          >
            <Tag size={14} />
            {connection.title || connection.itemId}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SynapseTile;
