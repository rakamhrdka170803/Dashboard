package repository

import (
	"time"

	"bjb-backoffice/internal/domain"

	"gorm.io/gorm"
)

type FindingRepository interface {
	Create(f *domain.Finding) error
	Delete(id uint) error
	ListFiltered(agentID *uint, from, to *time.Time, page, size int) ([]domain.Finding, int64, error)
	CountForAgentInMonth(agentID uint, month time.Time) (int64, error)
}

type findingRepository struct{ db *gorm.DB }

func NewFindingRepository(db *gorm.DB) FindingRepository { return &findingRepository{db: db} }

func (r *findingRepository) Create(f *domain.Finding) error { return r.db.Create(f).Error }

func (r *findingRepository) Delete(id uint) error { return r.db.Delete(&domain.Finding{}, id).Error }

func (r *findingRepository) ListFiltered(agentID *uint, from, to *time.Time, page, size int) ([]domain.Finding, int64, error) {
	var (
		items []domain.Finding
		total int64
	)
	q := r.db.Model(&domain.Finding{})
	if agentID != nil {
		q = q.Where("agent_id = ?", *agentID)
	}
	if from != nil {
		q = q.Where("issued_at >= ?", *from)
	}
	if to != nil {
		q = q.Where("issued_at < ?", *to)
	}

	q.Count(&total)
	err := q.Order("issued_at DESC").
		Limit(size).Offset((page - 1) * size).
		Find(&items).Error
	return items, total, err
}

func (r *findingRepository) CountForAgentInMonth(agentID uint, month time.Time) (int64, error) {
	// bulan berjalan: [monthStart, nextMonthStart)
	start := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.Local)
	end := start.AddDate(0, 1, 0)
	var n int64
	err := r.db.Model(&domain.Finding{}).
		Where("agent_id = ? AND issued_at >= ? AND issued_at < ?", agentID, start, end).
		Count(&n).Error
	return n, err
}
