import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Play, 
  Settings, 
  Shield, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Plus,
  Search,
  MoreVertical,
  Activity,
  Globe,
  Database,
  Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import NewProjectModal from '../components/NewProjectModal';
import { projectService } from '../services/projects';

const Dashboard = ({ onLogout, onOpenProject }) => {
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    const { data, error } = await projectService.getProjects();
    if (!error && data) {
      setProjects(data);
    }
    setLoading(false);
  };

  const handleEditProject = (e, project) => {
    e.stopPropagation(); // Don't open the project
    setEditingProject(project);
    setIsNewProjectModalOpen(true);
  };

  const handleDeleteProject = (e, project) => {
    e.stopPropagation(); // Don't open the project
    setProjectToDelete(project);
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    const { error } = await projectService.deleteProject(projectToDelete.id);
    if (!error) {
      fetchProjects();
    } else {
      alert('Failed to delete project: ' + error.message);
    }
    setProjectToDelete(null);
  };

  const stats = [
    { label: 'Total Tests', value: '0', change: '0%', icon: <Activity className="text-brand-400" /> },
    { label: 'Active Projects', value: projects.length.toString(), change: '0', icon: <Globe className="text-brand-400" /> },
    { label: 'Success Rate', value: '0%', change: '0%', icon: <CheckCircle2 className="text-emerald-400" /> },
    { label: 'Execution Time', value: '0m', change: '0%', icon: <Clock className="text-amber-400" /> },
  ];

  return (
    <div className="flex h-screen bg-dark-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 glass flex flex-col">
        <div className="p-6 flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Shield className="text-white" size={18} />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">UPAF</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <SidebarItem icon={<BarChart3 size={20} />} label="Overview" active />
          <SidebarItem icon={<Play size={20} />} label="Runs" />
          <SidebarItem icon={<Database size={20} />} label="Projects" />
          <SidebarItem icon={<Globe size={20} />} label="Domains" />
          <SidebarItem icon={<Settings size={20} />} label="Settings" />
        </nav>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <span className="text-sm font-medium">Log out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-white/5 glass flex items-center justify-between px-8">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search tests, domains, logs..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500/50 focus:outline-none text-sm transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsNewProjectModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all shadow-lg shadow-brand-500/20"
            >
              <Plus size={18} />
              New Project
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-xs font-bold border border-white/20">
              AD
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">System Overview</h1>
              <p className="text-slate-400 mt-1">Real-time performance and reliability metrics across all projects.</p>
            </div>
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
              <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-brand-600 text-white shadow-sm">24h</button>
              <button className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-400 hover:text-white transition-colors">7d</button>
              <button className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-400 hover:text-white transition-colors">30d</button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-6 glass rounded-2xl space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    {stat.icon}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    stat.change?.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-brand-500/10 text-brand-400'
                  }`}>
                    {stat.change}
                  </span>
                </div>
                <div>
                  <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Projects Table */}
          <div className="glass rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold text-xl text-white">Active Projects</h3>
              <button className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors">View All Projects</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 text-sm border-b border-white/5">
                    <th className="px-6 py-4 font-medium">Project Name</th>
                    <th className="px-6 py-4 font-medium">Model</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Last Executed</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        Loading projects...
                      </td>
                    </tr>
                  ) : projects.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-medium">
                        No projects found. Create your first project to get started!
                      </td>
                    </tr>
                  ) : (
                    projects.map((project) => (
                      <tr 
                        key={project.id} 
                        onClick={() => onOpenProject(project)}
                        className="hover:bg-white/5 transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-bold text-white group-hover:text-brand-400 transition-colors">{project.name}</p>
                            <p className="text-xs text-slate-500">
                              {project.environments?.[0]?.url || 'No URL configured'}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium px-2 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300 uppercase">
                            {project.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={project.status || 'Healthy'} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-sm">
                          {new Date(project.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={(e) => handleEditProject(e, project)}
                              className="p-2 text-slate-500 hover:text-brand-400 transition-colors"
                              title="Edit Project"
                            >
                              <Settings size={18} />
                            </button>
                            <button 
                              onClick={(e) => handleDeleteProject(e, project)}
                              className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
                              title="Delete Project"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <NewProjectModal 
        isOpen={isNewProjectModalOpen} 
        initialData={editingProject}
        onClose={() => {
          setIsNewProjectModalOpen(false);
          setEditingProject(null);
        }} 
        onSuccess={(projectData) => {
          setIsNewProjectModalOpen(false);
          setEditingProject(null);
          fetchProjects(); // Refresh the list
          onOpenProject(projectData);
        }}
      />

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm"
            onClick={() => setProjectToDelete(null)}
          />
          {/* Modal Card */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-md p-6 glass border border-white/10 rounded-3xl shadow-2xl text-center space-y-6"
          >
            <div className="mx-auto w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-400">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Delete Project</h3>
              <p className="text-sm text-slate-400">
                Are you sure you want to delete <span className="text-white font-semibold">{projectToDelete.name}</span>? 
                This action cannot be undone and will delete all associated test cases and test steps.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setProjectToDelete(null)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-all border border-white/5"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDeleteProject}
                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-rose-500/20"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const SidebarItem = ({ icon, label, active = false }) => (
  <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
    active 
      ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' 
      : 'text-slate-400 hover:text-white hover:bg-white/5'
  }`}>
    {icon}
    <span className="text-sm font-bold tracking-wide">{label}</span>
  </button>
);

const StatusBadge = ({ status }) => {
  const configs = {
    'Healthy': 'bg-emerald-500 text-emerald-500',
    'Warning': 'bg-amber-500 text-amber-500',
    'Critical': 'bg-rose-500 text-rose-500',
  };
  
  const colorClass = configs[status] || 'bg-slate-500';
  
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colorClass.split(' ')[0]} animate-pulse`} />
      <span className={`text-xs font-bold uppercase tracking-wider ${colorClass.split(' ')[1]}`}>
        {status}
      </span>
    </div>
  );
};

export default Dashboard;
