package service

import (
	"errors"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
)

type FindingService struct {
	findings repository.FindingRepository
	users    repository.UserRepository
}

func NewFindingService(findings repository.FindingRepository, users repository.UserRepository) *FindingService {
	return &FindingService{findings: findings, users: users}
}

type CreateFindingInput struct {
	AgentID     uint
	IssuedByID  uint
	Description string
	IssuedAt    *time.Time // optional; default now
}

func (s *FindingService) Create(in CreateFindingInput) (*domain.Finding, error) {
	if in.AgentID == 0 || in.IssuedByID == 0 || in.Description == "" {
		return nil, errors.New("agent_id/issued_by/description required")
	}
	// validasi agent & qc eksis (optional: cek role mereka)
	if _, err := s.users.FindByID(in.AgentID); err != nil {
		return nil, errors.New("agent not found")
	}
	if _, err := s.users.FindByID(in.IssuedByID); err != nil {
		return nil, errors.New("issuer not found")
	}

	f := &domain.Finding{
		AgentID:     in.AgentID,
		IssuedByID:  in.IssuedByID,
		Description: in.Description,
	}
	if in.IssuedAt != nil {
		f.IssuedAt = *in.IssuedAt
	}

	if err := s.findings.Create(f); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *FindingService) Delete(id uint) error { return s.findings.Delete(id) }

type ListFindingsFilter struct {
	AgentID *uint
	Month   *time.Time // jika diisi → override from/to
	From    *time.Time
	To      *time.Time
	Page    int
	Size    int
}

func (s *FindingService) ListFiltered(f ListFindingsFilter) ([]domain.Finding, int64, error) {
	from, to := f.From, f.To
	if f.Month != nil {
		start := time.Date(f.Month.Year(), f.Month.Month(), 1, 0, 0, 0, 0, time.Local)
		next := start.AddDate(0, 1, 0)
		from, to = &start, &next
	}
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Size < 1 || f.Size > 100 {
		f.Size = 10
	}

	return s.findings.ListFiltered(f.AgentID, from, to, f.Page, f.Size)
}

func (s *FindingService) CountForAgentInMonth(agentID uint, month time.Time) (int64, error) {
	return s.findings.CountForAgentInMonth(agentID, month)
}
