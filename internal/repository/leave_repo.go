package repository

import (
	"bjb-backoffice/internal/domain"
	"time"

	"gorm.io/gorm"
)

type LeaveRepository interface {
	Create(l *domain.LeaveRequest) error
	Update(l *domain.LeaveRequest) error
	FindByID(id uint) (*domain.LeaveRequest, error)
	List(requesterID *uint, status *domain.LeaveStatus, from, to *time.Time, page, size int) ([]domain.LeaveRequest, int64, error)
}

type leaveRepository struct{ db *gorm.DB }

func NewLeaveRepository(db *gorm.DB) LeaveRepository { return &leaveRepository{db: db} }

func (r *leaveRepository) Create(l *domain.LeaveRequest) error { return r.db.Create(l).Error }
func (r *leaveRepository) Update(l *domain.LeaveRequest) error { return r.db.Save(l).Error }
func (r *leaveRepository) FindByID(id uint) (*domain.LeaveRequest, error) {
	var m domain.LeaveRequest
	if err := r.db.First(&m, id).Error; err != nil {
		return nil, err
	}
	return &m, nil
}
func (r *leaveRepository) List(requesterID *uint, status *domain.LeaveStatus, from, to *time.Time, page, size int) ([]domain.LeaveRequest, int64, error) {
	q := r.db.Model(&domain.LeaveRequest{})
	if requesterID != nil {
		q = q.Where("requester_id = ?", *requesterID)
	}
	if status != nil {
		q = q.Where("status = ?", *status)
	}
	if from != nil {
		q = q.Where("start_date >= ?", from.Format("2006-01-02"))
	}
	if to != nil {
		q = q.Where("start_date < ?", to.Format("2006-01-02"))
	}
	var total int64
	q.Count(&total)
	var out []domain.LeaveRequest
	err := q.Order("created_at DESC").Limit(size).Offset((page - 1) * size).Find(&out).Error
	return out, total, err
}
