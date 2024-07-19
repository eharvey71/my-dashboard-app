import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './CustomAPIModule.module.css';

const CustomAPIModule = () => {
  const [apiUrl, setApiUrl] = useState('');
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(apiUrl);
      setApiData(response.data);
    } catch (err) {
      setError('Failed to fetch data. Please check the API URL and try again.');
      setApiData(null);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (data) => {
    if (!data || typeof data !== 'object') return null;

    if (Array.isArray(data)) {
      return (
        <table className={styles.apiTable}>
          <thead>
            <tr>
              {Object.keys(data[0]).map((key) => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                {Object.values(item).map((value, idx) => (
                  <td key={idx}>{JSON.stringify(value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      return (
        <table className={styles.apiTable}>
          <tbody>
            {Object.entries(data).map(([key, value]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{JSON.stringify(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  };

  return (
    <div className={styles.customApiModule}>
      <h3>Custom API Module</h3>
      <div className={styles.inputGroup}>
        <input
          type="text"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="Enter API URL"
          className={styles.apiInput}
        />
        <button onClick={fetchData} className={styles.fetchButton}>
          Fetch Data
        </button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className={styles.errorMessage}>{error}</p>}
      {apiData && renderTable(apiData)}
    </div>
  );
};

export default CustomAPIModule;