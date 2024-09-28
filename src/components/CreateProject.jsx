import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject } from '../services/firebaseConfig';

const CreateProject = ({ user, setHasProjects }) => {
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError('Project name cannot be empty');
      return;
    }
    try {
      const newProject = await createProject(user.uid, projectName);
      setHasProjects(true);
      navigate(`/project/${newProject.id}`);
    } catch (error) {
      setError('Failed to create project. Please try again.');
    }
  };

  return (
    <div className="container mt-5">
      <h2>Create Your First Project</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="projectName" className="form-label">Project Name</label>
          <input
            type="text"
            className="form-control"
            id="projectName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <button type="submit" className="btn btn-primary">Create Project</button>
      </form>
    </div>
  );
};

export default CreateProject;