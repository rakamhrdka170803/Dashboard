// internal/service/notification_service.go
package service

import (
	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
	"log"
)

type NotificationService struct {
	repo repository.NotificationRepository
}

func NewNotificationService(r repository.NotificationRepository) *NotificationService {
	return &NotificationService{repo: r}
}

func (n *NotificationService) Notify(userID uint, title, body, refType string, refID *uint) error {
	log.Printf("[notif] create request: uid=%d title=%q ref=%s#%v", userID, title, refType, valueOrZero(refID))
	err := n.repo.Create(&domain.Notification{
		UserID: userID, Title: title, Body: body, RefType: refType, RefID: refID,
	})
	if err != nil {
		log.Printf("[notif] create FAILED: uid=%d title=%q err=%v", userID, title, err)
		return err
	}
	log.Printf("[notif] create OK: uid=%d title=%q", userID, title)
	return nil
}

func (n *NotificationService) ListMine(userID uint, unread bool, limit int) ([]domain.Notification, error) {
	return n.repo.ListByUser(userID, unread, limit)
}
func (n *NotificationService) MarkRead(id uint) error { return n.repo.MarkRead(id) }

func valueOrZero(p *uint) uint {
	if p == nil {
		return 0
	}
	return *p
}
