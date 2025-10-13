package service

import (
	"errors"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
)

type LatenessService struct {
	lates repository.LatenessRepository
	users repository.UserRepository
}

func NewLatenessService(lates repository.LatenessRepository, users repository.UserRepository) *LatenessService {
	return &LatenessService{lates: lates, users: users}
}

type CreateLatenessInput struct {
	AgentID   uint
	Date      time.Time // date-only (ignored time part)
	Minutes   int
	NotedByID uint
}

func (s *LatenessService) Create(in CreateLatenessInput) (*domain.Lateness, error) {
	if in.AgentID == 0 || in.NotedByID == 0 {
		return nil, errors.New("agent_id/noted_by required")
	}
	if in.Minutes < 0 {
		return nil, errors.New("minutes must be >= 0")
	}
	if _, err := s.users.FindByID(in.AgentID); err != nil {
		return nil, errors.New("agent not found")
	}
	if _, err := s.users.FindByID(in.NotedByID); err != nil {
		return nil, errors.New("noted_by not found")
	}

	// normalisasi ke date 00:00 lokal
	d := time.Date(in.Date.Year(), in.Date.Month(), in.Date.Day(), 0, 0, 0, 0, in.Date.Location())
	L := &domain.Lateness{
		AgentID:   in.AgentID,
		Date:      d,
		Minutes:   in.Minutes,
		NotedByID: in.NotedByID,
	}
	if err := s.lates.Create(L); err != nil {
		return nil, err
	}
	return L, nil
}

func (s *LatenessService) Delete(id uint) error { return s.lates.Delete(id) }

type ListLateFilter struct {
	AgentID *uint
	From    *time.Time
	To      *time.Time
	Page    int
	Size    int
}

func (s *LatenessService) List(f ListLateFilter) ([]domain.Lateness, int64, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Size < 1 || f.Size > 100 {
		f.Size = 10
	}
	return s.lates.List(f.AgentID, f.From, f.To, f.Page, f.Size)
}

func (s *LatenessService) Aggregate(agentID *uint, from, to *time.Time, group string) ([]repository.AggRow, error) {
	return s.lates.Aggregate(agentID, from, to, group)
}
