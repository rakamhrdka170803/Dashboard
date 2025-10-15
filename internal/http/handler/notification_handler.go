package handler

import (
	"log"
	"net/http"
	"strconv"

	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type NotificationHandler struct{ svc *service.NotificationService }

func NewNotificationHandler(s *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{svc: s}
}

func (h *NotificationHandler) ListMine(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	me := uint(idf)

	unread := c.DefaultQuery("unread", "false") == "true"

	limit := 50
	if limStr := c.DefaultQuery("limit", ""); limStr != "" {
		if v, err := strconv.Atoi(limStr); err == nil && v > 0 && v <= 200 {
			limit = v
		}
	}

	items, err := h.svc.ListMine(me, unread, limit)
	if err != nil {
		log.Printf("[notif-list] failed uid=%d unread=%v limit=%d err=%v", me, unread, limit, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		out = append(out, gin.H{
			"id":         it.ID,
			"title":      it.Title,
			"body":       it.Body,
			"ref_type":   it.RefType,
			"ref_id":     it.RefID,
			"is_read":    it.IsRead,
			"created_at": it.CreatedAt,
		})
	}

	log.Printf("[notif-list] ok uid=%d unread=%v limit=%d items=%d", me, unread, limit, len(out))
	c.JSON(http.StatusOK, gin.H{"items": out})
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := h.svc.MarkRead(uint(id)); err != nil {
		log.Printf("[notif-read] failed id=%d err=%v", id, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	log.Printf("[notif-read] ok id=%d", id)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
