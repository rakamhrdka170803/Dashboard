package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type HolidaySwapHandler struct{ svc *service.HolidaySwapService }

func NewHolidaySwapHandler(s *service.HolidaySwapService) *HolidaySwapHandler {
	return &HolidaySwapHandler{svc: s}
}

type createHolidayReq struct {
	TargetUserID uint   `json:"target_user_id" binding:"required"`
	OffDate      string `json:"off_date" binding:"required"` // "YYYY-MM-DD"
	Reason       string `json:"reason"`
}

func (h *HolidaySwapHandler) Create(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	requester := uint(idf)

	var req createHolidayReq
	if err := c.ShouldBindJSON(&req); err != nil || req.TargetUserID == 0 || req.OffDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "target_user_id & off_date required"})
		return
	}
	t, err := time.ParseInLocation("2006-01-02", req.OffDate, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid off_date (YYYY-MM-DD)"})
		return
	}
	m, err := h.svc.Create(requester, req.TargetUserID, t, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": m.ID, "status": m.Status})
}

func (h *HolidaySwapHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	rows, total, err := h.svc.List(page, size)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	me := uint(idf)

	// BO roles yang boleh lihat semua
	allowed := map[string]bool{
		"SUPER_ADMIN": true,
		"HR_ADMIN":    true,
		"TL":          true,
		"SPV":         true,
		"QC":          true,
		"BACKOFFICE":  true, // optional
		"ADMIN":       true, // optional
	}
	isBackoffice := false
	switch rs := claims["roles"].(type) {
	case []interface{}:
		for _, r := range rs {
			if s, _ := r.(string); allowed[strings.ToUpper(strings.TrimSpace(s))] {
				isBackoffice = true
				break
			}
		}
	case []string:
		for _, s := range rs {
			if allowed[strings.ToUpper(strings.TrimSpace(s))] {
				isBackoffice = true
				break
			}
		}
	}

	out := make([]gin.H, 0, len(rows))
	for _, m := range rows {
		if !isBackoffice && m.RequesterID != me && m.TargetUserID != me {
			continue
		}
		out = append(out, gin.H{
			"id": m.ID, "requester_id": m.RequesterID, "target_user_id": m.TargetUserID,
			"off_date": m.OffDate, "reason": m.Reason, "status": m.Status,
			"approved_at": m.ApprovedAt, "created_schedule_id": m.CreatedScheduleID,
		})
	}
	c.JSON(http.StatusOK, gin.H{"page": page, "size": size, "total": total, "items": out})
}

func (h *HolidaySwapHandler) TargetAccept(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	me := uint(idf)

	id, _ := strconv.Atoi(c.Param("id"))
	m, err := h.svc.TargetAccept(uint(id), me)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status})
}

func (h *HolidaySwapHandler) TargetReject(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	me := uint(idf)

	id, _ := strconv.Atoi(c.Param("id"))
	m, err := h.svc.TargetReject(uint(id), me)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status})
}

// === BO approve: versi SIMPLE (hanya jam "HH:mm", end=+8h) ===
type boApproveSimpleReq struct {
	StartTime string             `json:"start_time" binding:"required"` // "HH:mm"
	Channel   domain.WorkChannel `json:"channel" binding:"required"`    // "VOICE"|"SOSMED"
	ShiftName *string            `json:"shift_name"`
	Notes     *string            `json:"notes"`
}

func (h *HolidaySwapHandler) BOApprove(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var req boApproveSimpleReq
	if err := c.ShouldBindJSON(&req); err != nil || req.StartTime == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body (start_time required, channel required)"})
		return
	}

	m, err := h.svc.BOApproveSimple(uint(id), 0, service.BOApproveSimpleInput{
		StartTime: req.StartTime,
		Channel:   req.Channel,
		ShiftName: req.ShiftName,
		Notes:     req.Notes,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status, "created_schedule_id": m.CreatedScheduleID})
}

func (h *HolidaySwapHandler) Cancel(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	me := uint(idf)

	id, _ := strconv.Atoi(c.Param("id"))
	m, err := h.svc.Cancel(uint(id), me)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status})
}
