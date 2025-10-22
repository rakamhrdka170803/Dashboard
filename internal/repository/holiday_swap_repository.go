// internal/repository/holiday_swap_repository.go
package repository

import (
	"bjb-backoffice/internal/domain"

	"gorm.io/gorm"
)

type HolidaySwapRepository interface {
	Create(m *domain.HolidaySwap) error
	Update(m *domain.HolidaySwap) error
	FindByID(id uint) (*domain.HolidaySwap, error)
	List(page, size int) ([]domain.HolidaySwap, int64, error)
}

type holidaySwapRepository struct{ db *gorm.DB }

func NewHolidaySwapRepository(db *gorm.DB) HolidaySwapRepository {
	return &holidaySwapRepository{db: db}
}

func (r *holidaySwapRepository) Create(m *domain.HolidaySwap) error { return r.db.Create(m).Error }

func (r *holidaySwapRepository) Update(m *domain.HolidaySwap) error { return r.db.Save(m).Error }

func (r *holidaySwapRepository) FindByID(id uint) (*domain.HolidaySwap, error) {
	var m domain.HolidaySwap
	if err := r.db.First(&m, id).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *holidaySwapRepository) List(page, size int) ([]domain.HolidaySwap, int64, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 500 {
		size = 20
	}
	var (
		rows  []domain.HolidaySwap
		total int64
	)
	if err := r.db.Model(&domain.HolidaySwap{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := r.db.
		Model(&domain.HolidaySwap{}).
		Order("created_at DESC").
		Limit(size).
		Offset((page - 1) * size).
		Find(&rows).Error
	return rows, total, err
}
