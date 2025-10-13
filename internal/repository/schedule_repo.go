package repository

import (
	"time"

	"bjb-backoffice/internal/domain"

	"gorm.io/gorm"
)

type ScheduleRepository interface {
	Create(s *domain.Schedule) error
	Update(s *domain.Schedule) error
	Delete(id uint) error
	FindByID(id uint) (*domain.Schedule, error)
	ListMonthly(userID *uint, month time.Time) ([]domain.Schedule, error)
	ExistsOverlap(userID uint, start, end time.Time, excludeID *uint) (bool, error)
	// NEW:
	FindByUserAndWindow(userID uint, start, end time.Time) (*domain.Schedule, error)
	Tx(fn func(tx *gorm.DB) error) error
}

type scheduleRepository struct{ db *gorm.DB }

func NewScheduleRepository(db *gorm.DB) ScheduleRepository { return &scheduleRepository{db: db} }

func (r *scheduleRepository) Create(s *domain.Schedule) error { return r.db.Create(s).Error }
func (r *scheduleRepository) Update(s *domain.Schedule) error { return r.db.Save(s).Error }
func (r *scheduleRepository) Delete(id uint) error            { return r.db.Delete(&domain.Schedule{}, id).Error }
func (r *scheduleRepository) FindByID(id uint) (*domain.Schedule, error) {
	var s domain.Schedule
	if err := r.db.First(&s, id).Error; err != nil {
		return nil, err
	}
	return &s, nil
}
func (r *scheduleRepository) ListMonthly(userID *uint, month time.Time) ([]domain.Schedule, error) {
	start := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.Local)
	end := start.AddDate(0, 1, 0)
	q := r.db.Where("start_at < ? AND end_at >= ?", end, start)
	if userID != nil {
		q = q.Where("user_id = ?", *userID)
	}
	var out []domain.Schedule
	return out, q.Order("start_at ASC").Find(&out).Error
}

func (r *scheduleRepository) ExistsOverlap(userID uint, start, end time.Time, excludeID *uint) (bool, error) {
	q := r.db.Model(&domain.Schedule{}).
		Where("user_id = ?", userID).
		// NOT (end <= start OR start >= end)  <=>  overlap
		Where("NOT (end_at <= ? OR start_at >= ?)", start, end)
	if excludeID != nil {
		q = q.Where("id <> ?", *excludeID)
	}
	var cnt int64
	if err := q.Count(&cnt).Error; err != nil {
		return false, err
	}
	return cnt > 0, nil
}

func (r *scheduleRepository) FindByUserAndWindow(userID uint, start, end time.Time) (*domain.Schedule, error) {
	var s domain.Schedule
	if err := r.db.Where("user_id = ? AND start_at = ? AND end_at = ?", userID, start, end).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *scheduleRepository) Tx(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}
