import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { logout } from '../services/firebaseAuth';
import { getUserProjects, createProject } from '../services/firebaseConfig';

const NavBar = ({ user, displayName }) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(projectId || '');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      if (user) {
        const userProjects = await getUserProjects(user.uid);
        setProjects(userProjects);
        if (!selectedProject && userProjects.length > 0) {
          setSelectedProject(userProjects[0].id);
        }
      }
    };
    fetchProjects();
  }, [user]);

  useEffect(() => {
    if (projectId) {
      setSelectedProject(projectId);
    }
  }, [projectId]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleProjectChange = (e) => {
    const newProjectId = e.target.value;
    setSelectedProject(newProjectId);
    if (newProjectId) {
      navigate(`/project/${newProjectId}`);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      try {
        const newProject = await createProject(user.uid, newProjectName.trim());
        setProjects([...projects, newProject]);
        setSelectedProject(newProject.id);
        setNewProjectName('');
        setShowCreateProject(false);
        navigate(`/project/${newProject.id}`);
      } catch (error) {
        console.error('Error creating project:', error);
      }
    }
  };

  const appTitle = user && displayName ? `${displayName}'s Cognify` : 'My Cognify';

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/" onClick={() => setShowCreateProject(!showCreateProject)}>{appTitle}</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {user ? (
              <>
                <li className="nav-item">
                  <select 
                    className="form-select" 
                    value={selectedProject} 
                    onChange={handleProjectChange}
                  >
                    {projects.length === 0 ? (
                      <option value="">Select Project</option>
                    ) : (
                      projects.map(project => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))
                    )}
                  </select>
                </li>
                {selectedProject && (
                  <>
                    <li className="nav-item">
                      <Link className="nav-link" to={`/project/${selectedProject}`}>Dashboard</Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to={`/project/${selectedProject}/documents`}>Documents</Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to={`/project/${selectedProject}/focus`}>Focus</Link>
                    </li>
                  </>
                )}
                <li className="nav-item">
                  <button className="btn btn-link nav-link" onClick={handleLogout}>Logout</button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">Login</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/signup">Signup</Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
      {showCreateProject && (
        <div className="container mt-3">
          <form onSubmit={handleCreateProject}>
            <div className="input-group">
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
      )}
    </nav>
  );
};

export default NavBar;