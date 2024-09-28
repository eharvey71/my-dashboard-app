import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserProjects, createProject } from '../services/firebaseConfig';

const ProjectList = ({ user, onProjectsUpdate }) => {
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    if (user) {
      const userProjects = await getUserProjects(user.uid);
      setProjects(userProjects);
      if (onProjectsUpdate) {
        onProjectsUpdate(userProjects);
      }
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError('');
    if (!newProjectName.trim()) {
      setError('Project name cannot be empty');
      return;
    }
    try {
      await createProject(user.uid, newProjectName.trim());
      await fetchProjects();
      setNewProjectName('');
    } catch (error) {
      setError('Failed to create project. Please try again.');
    }
  };

  return (
    <div className="container mt-5">
      <h2>My Projects</h2>
      {projects.length > 0 ? (
        <ul className="list-group mb-4">
          {projects.map((project) => (
            <li key={project.id} className="list-group-item">
              <Link to={`/project/${project.id}`}>{project.name}</Link>
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