import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject, updateProject } from '../services/firebaseConfig';
import { useProjectContext } from '../contexts/ProjectContext';

const ProjectList = ({ user }) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const { projects, addProject, updateActiveProject, updateProjectName } = useProjectContext();
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

  const handleEditClick = (project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const handleEditChange = (e) => {
    setEditingProjectName(e.target.value);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingProjectName.trim()) {
      setError('Project name cannot be empty');
      return;
    }
    try {
      await updateProject(editingProjectId, { name: editingProjectName.trim() });
      updateProjectName(editingProjectId, editingProjectName.trim());
      setEditingProjectId(null);
      setEditingProjectName('');
      setError('');
    } catch (error) {
      setError('Failed to update project name. Please try again.');
    }
  };

  const handleEditCancel = () => {
    setEditingProjectId(null);
    setEditingProjectName('');
    setError('');
  };

  return (
    <div className="container mt-5">
      <h2 className="mb-4">My Projects</h2>
      <div className="row">
        {/* Left column: New Project Form */}
        <div className="col-md-5">
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

        {/* Right column: Project List */}
        <div className="col-md-7">
          {projects.length > 0 ? (
            <div className="card">
              <div className="card-body">
                <h3 className="card-title">Existing Projects</h3>
                <ul className="list-group">
                  {projects.map((project) => (
                    <li key={project.id} className="list-group-item d-flex justify-content-between align-items-center">
                      {editingProjectId === project.id ? (
                        <form onSubmit={handleEditSubmit} className="d-flex w-100">
                          <input
                            type="text"
                            className="form-control me-2"
                            value={editingProjectName}
                            onChange={handleEditChange}
                            autoFocus
                          />
                          <button type="submit" className="btn btn-success btn-sm me-1">Save</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={handleEditCancel}>Cancel</button>
                        </form>
                      ) : (
                        <>
                          <a href="#" onClick={() => handleProjectClick(project.id)} className="text-decoration-none flex-grow-1">
                            {project.name}
                          </a>
                          <button className="btn btn-outline-primary btn-sm" onClick={() => handleEditClick(project)}>Edit</button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <p className="card-text">You don't have any projects yet. Create one using the form on the left!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectList;