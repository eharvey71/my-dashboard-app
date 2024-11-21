import React from 'react';
import Task from './Task';
import styles from './Task.module.css';

const ProjectTaskItem = ({ task, projectName, ...props }) => {
  return (
    <div className="position-relative">
      <Task task={task} {...props} />
      <span 
        className="position-absolute top-0 end-0 badge bg-secondary mt-2 me-5" 
        style={{ zIndex: 5 }}
      >
        {projectName}
      </span>
    </div>
  );
};

export default ProjectTaskItem;