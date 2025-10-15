package repository

import (
	"errors"

	"bjb-backoffice/internal/domain"

	"gorm.io/gorm"
)

type SwapRepository interface {
	Create(sw *domain.SwapRequest) error
	Update(sw *domain.SwapRequest) error
	FindByID(id uint) (*domain.SwapRequest, error)
	ListAll(page, size int) ([]domain.SwapRequest, int64, error)
}

type swapRepository struct{ db *gorm.DB }

func NewSwapRepository(db *gorm.DB) SwapRepository { return &swapRepository{db: db} }

func (r *swapRepository) Create(sw *domain.SwapRequest) error { return r.db.Create(sw).Error }

func (r *swapRepository) Update(sw *domain.SwapRequest) error {
	if sw.ID == 0 {
		return errors.New("swap id required")
	}
	return r.db.Save(sw).Error
}

func (r *swapRepository) FindByID(id uint) (*domain.SwapRequest, error) {
	var m domain.SwapRequest
	if err := r.db.First(&m, id).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *swapRepository) ListAll(page, size int) ([]domain.SwapRequest, int64, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 500 {
		size = 20
	}
	var (
		rows  []domain.SwapRequest
		total int64
	)
	if err := r.db.Model(&domain.SwapRequest{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := r.db.
		Model(&domain.SwapRequest{}).
		Order("created_at DESC").
		Limit(size).
		Offset((page - 1) * size).
		Find(&rows).Error
	return rows, total, err
}
