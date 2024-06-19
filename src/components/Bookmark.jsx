import React, { useState } from 'react';
import axios from 'axios';

const Bookmark = () => {
    const [url, setUrl] = useState('');
    const [metaData, setMetaData] = useState({});

    const fetchMetaData = async () => {
        try {
            const response = await axios.get(`https://api.linkpreview.net?key=your_api_key&q=${url}`);
            setMetaData(response.data);
        } catch (error) {
            console.error("Error fetching metadata: ", error);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        fetchMetaData();
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input 
                    type="text" 
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)} 
                    placeholder="Enter URL" 
                />
                <button type="submit">Save Bookmark</button>
            </form>
            {metaData.title && (
                <div>
                    <h3>{metaData.title}</h3>
                    <img src={metaData.image} alt={metaData.title} />
                    <p>{metaData.description}</p>
                </div>
            )}
        </div>
    );
};

export default Bookmark;