import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createProject } from '../services/firebaseConfig';
import { useProjectContext } from '../contexts/ProjectContext';

const ProjectList = ({ user }) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState('');
  const { projects, addProject, updateActiveProject } = useProjectContext();
  const navigate = useNavigate();

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError('');
    if (!newProjectName.trim()) {
      setError('Project name cannot be empty');
      return;
    }
    try {
      const newProject = await createProject(user.uid, newProjectName.trim());
      addProject(newProject);
      setNewProjectName('');
      navigate(`/project/${newProject.id}`);
    } catch (error) {
      setError('Failed to create project. Please try again.');
    }
  };

  const handleProjectClick = (projectId) => {
    updateActiveProject(projectId);
    navigate(`/project/${projectId}`);
  };

  return (
    <div className="container mt-5">
      <h2>My Projects</h2>
      {projects.length > 0 ? (
        <ul className="list-group mb-4">
          {projects.map((project) => (
            <li key={project.id} className="list-group-item">
              <a href="#" onClick={() => handleProjectClick(project.id)}>{project.name}</a>
            </li>
          ))}
        </ul>
      ) : (
        <p>You don't have any projects yet. Create one below!</p>
      )}
      <div className="card">
        <div className="card-body">
          <h3 className="card-title">Create New Project</h3>
          <form onSubmit={handleCreateProject}>
            <div className="mb-3">
              <label htmlFor="projectName" className="form-label">Project Name</label>
              <input
                type="text"
                className="form-control"
                id="projectName"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                required
              />
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            <button type="submit" className="btn btn-primary">Create Project</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProjectList;