import { useState, useEffect } from 'react';
import type { Job, Candidate } from './types';
import { DashboardStats } from './components/DashboardStats';
import { JobCard } from './components/JobCard';
import { PipelineBoard } from './components/PipelineBoard';
import { ResumeUpload } from './components/ResumeUpload';
import { CandidateModal } from './components/CandidateModal';
import { JobForm } from './components/JobForm';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'pipeline' | 'create-job'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch initial data from backend API
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const jobsRes = await fetch(`${API_BASE_URL}/api/jobs`);
        if (!jobsRes.ok) throw new Error("Failed to fetch jobs");
        const jobsData = await jobsRes.json();
        setJobs(jobsData);

        // If a job is selected, fetch its candidates, else fetch all candidates
        if (selectedJobId) {
          const candRes = await fetch(`${API_BASE_URL}/api/jobs/${selectedJobId}/candidates`);
          if (!candRes.ok) throw new Error("Failed to fetch candidates");
          const candData = await candRes.json();
          setCandidates(candData);
        } else {
          // Flatten all candidates for dashboard stats
          const allCandidates: Candidate[] = [];
          for (const job of jobsData) {
            const candRes = await fetch(`${API_BASE_URL}/api/jobs/${job.id}/candidates`);
            if (candRes.ok) {
              const candData = await candRes.json();
              allCandidates.push(...candData);
            }
          }
          setCandidates(allCandidates);
        }
      } catch (err: any) {
        console.error(err);
        setError("Could not connect to the backend server. Make sure it is running on port 5000.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [selectedJobId]);

  // Handle job selection and redirect to pipeline view
  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentView('pipeline');
  };

  // API handler: create new job
  const handleCreateJob = async (jobData: Omit<Job, 'id' | 'createdAt' | 'status'>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData),
      });

      if (!response.ok) throw new Error("Failed to create job posting");
      
      const newJob = await response.json();
      setJobs(prev => [newJob, ...prev]);
      setSelectedJobId(newJob.id);
      setCurrentView('pipeline');
    } catch (err: any) {
      alert(err.message || "Error creating job");
    }
  };

  // API handler: delete job
  const handleDeleteJob = async (jobId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error("Failed to delete job");
      
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setCandidates(prev => prev.filter(c => c.jobId !== jobId));
      if (selectedJobId === jobId) {
        setSelectedJobId(null);
        setCurrentView('dashboard');
      }
    } catch (err: any) {
      alert(err.message || "Error deleting job");
    }
  };

  // API handler: update candidate status (Kanban drag & drop)
  const handleMoveCandidate = async (candidateId: string, newStatus: Candidate['status']) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error("Failed to update status");

      const updatedCandidate = await response.json();
      
      // Update local state
      setCandidates(prev => prev.map(c => c.id === candidateId ? updatedCandidate : c));
      
      // Update modal overlay state if open
      if (selectedCandidate && selectedCandidate.id === candidateId) {
        setSelectedCandidate(updatedCandidate);
      }
    } catch (err: any) {
      alert(err.message || "Error moving candidate");
    }
  };

  // API handler: delete candidate
  const handleDeleteCandidate = async (candidateId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error("Failed to delete candidate");

      setCandidates(prev => prev.filter(c => c.id !== candidateId));
      if (selectedCandidate && selectedCandidate.id === candidateId) {
        setSelectedCandidate(null);
      }
    } catch (err: any) {
      alert(err.message || "Error deleting candidate");
    }
  };

  // Upload callback: appends parsed candidates
  const handleUploadSuccess = (newCandidates: Candidate[]) => {
    setCandidates(prev => [...newCandidates, ...prev]);
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="app-container">
      
      {/* Navigation header */}
      <header className="navbar">
        <div className="brand" onClick={() => { setSelectedJobId(null); setCurrentView('dashboard'); }} style={{ cursor: 'pointer' }}>
          <span>🚀</span> Antigravity <span>ATS</span>
        </div>
        <div className="nav-links">
          <button 
            className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setSelectedJobId(null); setCurrentView('dashboard'); }}
          >
            Dashboard Overview
          </button>
          {selectedJobId && (
            <button 
              className={`nav-link ${currentView === 'pipeline' ? 'active' : ''}`}
              onClick={() => setCurrentView('pipeline')}
            >
              Pipeline: {selectedJob?.title}
            </button>
          )}
          <button 
            className={`nav-link ${currentView === 'create-job' ? 'active' : ''}`}
            onClick={() => setCurrentView('create-job')}
          >
            + Post New Job
          </button>
        </div>
      </header>

      {/* Global connection error indicator */}
      {error && (
        <div style={{ padding: '1rem 2rem', background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--border-radius)', color: '#f87171', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>⚠️ {error}</div>
          <button className="btn btn-secondary" onClick={() => setSelectedJobId(selectedJobId)} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="spinner-container" style={{ minHeight: '300px' }}>
          <div className="spinner"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading ATS Hub...</p>
        </div>
      )}

      {/* VIEW COMPONENTS */}
      {!loading && !error && (
        <main>
          
          {/* 1. DASHBOARD OVERVIEW VIEW */}
          {currentView === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <DashboardStats jobs={jobs} candidates={candidates} />
              
              <div>
                <div className="section-header">
                  <h2>Open Job Postings</h2>
                  <button className="btn btn-primary" onClick={() => setCurrentView('create-job')}>
                    Create Posting
                  </button>
                </div>
                
                {jobs.length === 0 ? (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <p style={{ fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.5rem' }}>No open job postings</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Start by adding a job listing to screen candidates against.</p>
                    <button className="btn btn-primary" onClick={() => setCurrentView('create-job')}>Post a Job</button>
                  </div>
                ) : (
                  <div className="jobs-grid">
                    {jobs.map(job => (
                      <JobCard 
                        key={job.id} 
                        job={job} 
                        candidates={candidates}
                        onClick={() => handleSelectJob(job.id)}
                        onDelete={() => handleDeleteJob(job.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. JOB PIPELINE VIEW */}
          {currentView === 'pipeline' && selectedJob && (
            <div className="pipeline-container">
              <div className="pipeline-header">
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700 }}>
                    {selectedJob.title}
                  </h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {selectedJob.department} &bull; {selectedJob.location} &bull; {selectedJob.type}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => { setSelectedJobId(null); setCurrentView('dashboard'); }}
                  >
                    ← Back to Jobs
                  </button>
                </div>
              </div>

              {/* Upload Panel and Kanban board */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <PipelineBoard 
                    candidates={candidates}
                    onSelectCandidate={setSelectedCandidate}
                    onMoveCandidate={handleMoveCandidate}
                    onDeleteCandidate={handleDeleteCandidate}
                  />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <ResumeUpload 
                    jobId={selectedJob.id}
                    onUploadSuccess={handleUploadSuccess}
                  />

                  <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.8rem' }}>Target Profile Details</h4>
                    <p><strong>Required Experience:</strong> {selectedJob.experience} {selectedJob.experience === 1 ? 'year' : 'years'}+</p>
                    <p><strong>Education:</strong> {selectedJob.education}</p>
                    <p style={{ marginTop: '0.8rem' }}><strong>Target Keywords:</strong></p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
                      {selectedJob.skills.map((skill, idx) => (
                        <span key={idx} className="skill-tag" style={{ fontSize: '0.7rem' }}>{skill}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. POST A JOB VIEW */}
          {currentView === 'create-job' && (
            <JobForm 
              onSubmit={handleCreateJob}
              onCancel={() => { setSelectedJobId(null); setCurrentView('dashboard'); }}
            />
          )}

        </main>
      )}

      {/* 4. CANDIDATE PROFILE ASSESSMENT MODAL */}
      {selectedCandidate && (
        <CandidateModal 
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onStatusChange={handleMoveCandidate}
          onDelete={handleDeleteCandidate}
        />
      )}

    </div>
  );
}

export default App;
