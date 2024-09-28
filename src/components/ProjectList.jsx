import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserProjects, createProject } from '../services/firebaseConfig';

const ProjectList = ({ user }) => {
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      if (user) {
        const userProjects = await getUserProjects(user.uid);
        setProjects(userProjects);
      }
    };
    fetchProjects();
  }, [user]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (newProjectName.trim() && user) {
      const newProject = await createProject(user.uid, newProjectName.trim());
      setProjects([...projects, newProject]);
      setNewProjectName('');
    }
  };

  return (
    <div className="project-list">
      <h2>My Projects</h2>
      <ul className="list-group mb-3">
        {projects.map((project) => (
          <li key={project.id} className="list-group-item">
            <Link to={`/project/${project.id}`}>{project.name}</Link>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreateProject}>
        <div className="input-group mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="New Project Name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">Create Project</button>
        </div>
      </form>
    </div>
  );
};

export default ProjectList;