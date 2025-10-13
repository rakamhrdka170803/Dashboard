package repository

import (
	"bjb-backoffice/internal/domain"

	"gorm.io/gorm"
)

type SwapRepository interface {
	Create(s *domain.SwapRequest) error
	Update(s *domain.SwapRequest) error
	FindByID(id uint) (*domain.SwapRequest, error)
	ListAll(page, size int) ([]domain.SwapRequest, int64, error)
}

type swapRepository struct{ db *gorm.DB }

func NewSwapRepository(db *gorm.DB) SwapRepository { return &swapRepository{db: db} }

func (r *swapRepository) Create(s *domain.SwapRequest) error { return r.db.Create(s).Error }
func (r *swapRepository) Update(s *domain.SwapRequest) error { return r.db.Save(s).Error }
func (r *swapRepository) FindByID(id uint) (*domain.SwapRequest, error) {
	var m domain.SwapRequest
	if err := r.db.First(&m, id).Error; err != nil {
		return nil, err
	}
	return &m, nil
}
func (r *swapRepository) ListAll(page, size int) ([]domain.SwapRequest, int64, error) {
	var total int64
	r.db.Model(&domain.SwapRequest{}).Count(&total)
	var out []domain.SwapRequest
	err := r.db.Order("created_at DESC").Limit(size).Offset((page - 1) * size).Find(&out).Error
	return out, total, err
}
