import React from 'react';
import type { Candidate } from '../types';
import { CandidateCard } from './CandidateCard';

interface PipelineBoardProps {
  candidates: Candidate[];
  stages?: Candidate['status'][];
  onSelectCandidate: (candidate: Candidate) => void;
  onMoveCandidate: (candidateId: string, newStatus: Candidate['status']) => void;
  onDeleteCandidate: (candidateId: string) => void;
}

const STAGES: Candidate['status'][] = ["Applied", "Screening", "Interview", "Offered", "Rejected"];

export const PipelineBoard: React.FC<PipelineBoardProps> = ({ 
  candidates, 
  stages = STAGES,
  onSelectCandidate, 
  onMoveCandidate,
  onDeleteCandidate
}) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow dropping
  };

  const handleDrop = (e: React.DragEvent, targetStatus: Candidate['status']) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData('text/plain');
    if (candidateId) {
      onMoveCandidate(candidateId, targetStatus);
    }
  };

  // Get color or icon for different column headers
  const getStageHeaderStyle = (stage: Candidate['status']) => {
    switch(stage) {
      case 'Applied': return { borderTop: '3px solid var(--text-secondary)' };
      case 'Screening': return { borderTop: '3px solid var(--warning)' };
      case 'Interview': return { borderTop: '3px solid var(--primary)' };
      case 'Offered': return { borderTop: '3px solid var(--success)' };
      case 'Rejected': return { borderTop: '3px solid var(--danger)' };
      default: return {};
    }
  };

  return (
    <div className="pipeline-board" style={{ '--cols': stages.length } as React.CSSProperties}>
      {stages.map(stage => {
        const stageCandidates = candidates.filter(c => c.status === stage);
        
        return (
          <div 
            key={stage} 
            className="pipeline-column"
            style={getStageHeaderStyle(stage)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage)}
          >
            <div className="column-header">
              <span className="column-title">
                {stage === 'Applied' && '📥 '}
                {stage === 'Screening' && '🔍 '}
                {stage === 'Interview' && '🤝 '}
                {stage === 'Offered' && '✨ '}
                {stage === 'Rejected' && '❌ '}
                {stage}
              </span>
              <span className="column-count">{stageCandidates.length}</span>
            </div>

            <div className="column-cards">
              {stageCandidates.length === 0 ? (
                <div style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  border: '1px dashed rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  marginTop: '0.5rem'
                }}>
                  Drop cards here
                </div>
              ) : (
                stageCandidates.map(candidate => (
                  <CandidateCard 
                    key={candidate.id}
                    candidate={candidate}
                    onSelect={() => onSelectCandidate(candidate)}
                    onDelete={() => onDeleteCandidate(candidate.id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
