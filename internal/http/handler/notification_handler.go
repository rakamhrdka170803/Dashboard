package handler

import (
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
	items, err := h.svc.ListMine(me, unread, 50)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		out = append(out, gin.H{"id": it.ID, "title": it.Title, "body": it.Body, "ref_type": it.RefType, "ref_id": it.RefID, "is_read": it.IsRead, "created_at": it.CreatedAt})
	}
	c.JSON(http.StatusOK, gin.H{"items": out})
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := h.svc.MarkRead(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
