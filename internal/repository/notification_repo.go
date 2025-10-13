package repository

import (
	"bjb-backoffice/internal/domain"

	"gorm.io/gorm"
)

type NotificationRepository interface {
	Create(n *domain.Notification) error
	ListByUser(userID uint, onlyUnread bool, limit int) ([]domain.Notification, error)
	MarkRead(id uint) error
}

type notificationRepository struct{ db *gorm.DB }

func NewNotificationRepository(db *gorm.DB) NotificationRepository {
	return &notificationRepository{db: db}
}

func (r *notificationRepository) Create(n *domain.Notification) error { return r.db.Create(n).Error }
func (r *notificationRepository) ListByUser(userID uint, onlyUnread bool, limit int) ([]domain.Notification, error) {
	q := r.db.Where("user_id = ?", userID).Order("created_at DESC")
	if onlyUnread {
		q = q.Where("is_read = false")
	}
	if limit <= 0 {
		limit = 50
	}
	var out []domain.Notification
	return out, q.Limit(limit).Find(&out).Error
}
func (r *notificationRepository) MarkRead(id uint) error {
	return r.db.Model(&domain.Notification{}).Where("id = ?", id).Update("is_read", true).Error
}
