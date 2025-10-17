// internal/repository/notification_repo.go
package repository

import (
	"bjb-backoffice/internal/domain"
	"log"

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

func (r *notificationRepository) Create(n *domain.Notification) error {
	if n == nil {
		return nil
	}
	err := r.db.Create(n).Error
	if err != nil {
		log.Printf("[notif-repo] insert FAILED user_id=%d title=%q err=%v", n.UserID, n.Title, err)
	} else {
		log.Printf("[notif-repo] insert OK user_id=%d title=%q id=%d", n.UserID, n.Title, n.ID)
	}
	return err
}

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
