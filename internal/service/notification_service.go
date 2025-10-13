package service

import (
	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
)

type NotificationService struct {
	repo repository.NotificationRepository
}

func NewNotificationService(r repository.NotificationRepository) *NotificationService {
	return &NotificationService{repo: r}
}

func (n *NotificationService) Notify(userID uint, title, body, refType string, refID *uint) error {
	return n.repo.Create(&domain.Notification{UserID: userID, Title: title, Body: body, RefType: refType, RefID: refID})
}
func (n *NotificationService) ListMine(userID uint, unread bool, limit int) ([]domain.Notification, error) {
	return n.repo.ListByUser(userID, unread, limit)
}
func (n *NotificationService) MarkRead(id uint) error { return n.repo.MarkRead(id) }
