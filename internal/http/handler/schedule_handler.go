package handler

import (
	"net/http"
	"strconv"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type ScheduleHandler struct {
	svc   *service.ScheduleService
	users repository.UserRepository // <-- untuk ambil full_name
}

func NewScheduleHandler(s *service.ScheduleService, ur repository.UserRepository) *ScheduleHandler {
	return &ScheduleHandler{svc: s, users: ur}
}

type createScheduleReq struct {
	UserID    uint               `json:"user_id" binding:"required"`
	StartAt   string             `json:"start_at" binding:"required"` // RFC3339
	EndAt     string             `json:"end_at" binding:"required"`   // RFC3339
	Channel   domain.WorkChannel `json:"channel" binding:"required"`  // "VOICE" | "SOSMED"
	ShiftName *string            `json:"shift_name"`
	Notes     *string            `json:"notes"`
}

func (h *ScheduleHandler) Create(c *gin.Context) {
	var req createScheduleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	st, err := time.Parse(time.RFC3339, req.StartAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_at"})
		return
	}
	en, err := time.Parse(time.RFC3339, req.EndAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_at"})
		return
	}
	m, err := h.svc.Create(service.CreateScheduleInput{
		UserID: req.UserID, StartAt: st, EndAt: en, Channel: req.Channel, ShiftName: req.ShiftName, Notes: req.Notes,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": m.ID})
}

type updateScheduleReq struct {
	UserID    *uint               `json:"user_id"`
	StartAt   *string             `json:"start_at"` // RFC3339
	EndAt     *string             `json:"end_at"`   // RFC3339
	Channel   *domain.WorkChannel `json:"channel"`
	ShiftName *string             `json:"shift_name"`
	Notes     *string             `json:"notes"`
}

func (h *ScheduleHandler) Update(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	sch, err := h.svc.FindByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "schedule not found"})
		return
	}

	var req updateScheduleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.UserID != nil {
		sch.UserID = *req.UserID
	}
	if req.Channel != nil {
		sch.Channel = *req.Channel
	}
	if req.ShiftName != nil {
		sch.ShiftName = req.ShiftName
	}
	if req.Notes != nil {
		sch.Notes = req.Notes
	}
	if req.StartAt != nil {
		if st, err := time.Parse(time.RFC3339, *req.StartAt); err == nil {
			sch.StartAt = st
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_at"})
			return
		}
	}
	if req.EndAt != nil {
		if en, err := time.Parse(time.RFC3339, *req.EndAt); err == nil {
			sch.EndAt = en
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_at"})
			return
		}
	}
	if err := h.svc.UpdateSchedule(sch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func (h *ScheduleHandler) Delete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := h.svc.Delete(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// GET /schedules/monthly — RBAC: Agent hanya miliknya; backoffice bisa pilih ?user_id atau semua
func (h *ScheduleHandler) ListMonthly(c *gin.Context) {
	monthStr := c.DefaultQuery("month", time.Now().Format("2006-01"))
	t, err := time.Parse("2006-01", monthStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid month"})
		return
	}

	// RBAC visibility: agent hanya boleh lihat miliknya
	var userID *uint
	if q := c.Query("user_id"); q != "" {
		if n, err := strconv.Atoi(q); err == nil {
			u := uint(n)
			userID = &u
		}
	}

	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	isAgent := false
	self := uint(0)
	if idf, ok := claims["sub"].(float64); ok {
		self = uint(idf)
	}
	switch rs := claims["roles"].(type) {
	case []interface{}:
		for _, r := range rs {
			if s, ok := r.(string); ok && s == "AGENT" {
				isAgent = true
				break
			}
		}
	case []string:
		for _, s := range rs {
			if s == "AGENT" {
				isAgent = true
				break
			}
		}
	}
	if isAgent {
		if userID != nil && *userID != self {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if userID == nil {
			userID = &self
		}
	}

	items, err := h.svc.ListMonthly(userID, t)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		out = append(out, gin.H{
			"id": it.ID, "user_id": it.UserID,
			"start_at": it.StartAt, "end_at": it.EndAt,
			"channel":    it.Channel,
			"shift_name": it.ShiftName, "notes": it.Notes,
		})
	}
	c.JSON(http.StatusOK, gin.H{"month": monthStr, "items": out})
}

// GET /schedules/monthly-all — semua user untuk matrix; tambahkan user_full_name
func (h *ScheduleHandler) ListMonthlyAll(c *gin.Context) {
	monthStr := c.DefaultQuery("month", time.Now().Format("2006-01"))
	t, err := time.Parse("2006-01", monthStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid month"})
		return
	}

	items, err := h.svc.ListMonthly(nil, t) // nil => semua user
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ambil nama user → map[id]full_name
	users, _, _ := h.users.List(1, 5000)
	names := make(map[uint]string, len(users))
	for _, u := range users {
		names[u.ID] = u.FullName
	}

	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		out = append(out, gin.H{
			"id": it.ID, "user_id": it.UserID,
			"user_full_name": names[it.UserID],
			"start_at":       it.StartAt, "end_at": it.EndAt,
			"channel":    it.Channel,
			"shift_name": it.ShiftName, "notes": it.Notes,
		})
	}
	c.JSON(http.StatusOK, gin.H{"month": monthStr, "items": out})
}

func (h *ScheduleHandler) OffDays(c *gin.Context) {
	uidStr := c.Param("id")
	uid64, err := strconv.ParseUint(uidStr, 10, 64)
	if err != nil || uid64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}
	monthStr := c.DefaultQuery("month", time.Now().Format("2006-01"))
	t, err := time.Parse("2006-01", monthStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid month"})
		return
	}

	// Ambil semua jadwal user tsb di bulan itu
	u := uint(uid64)
	items, err := h.svc.ListMonthly(&u, t)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// tandai hari yang busy
	startMonth := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.Local)
	days := time.Date(t.Year(), t.Month()+1, 0, 0, 0, 0, 0, time.Local).Day()
	busy := map[string]bool{}
	for _, it := range items {
		d := time.Date(it.StartAt.Year(), it.StartAt.Month(), it.StartAt.Day(), 0, 0, 0, 0, time.Local)
		key := d.Format("2006-01-02")
		busy[key] = true
	}
	// susun off list (hari yang tidak busy)
	off := []string{}
	for i := 0; i < days; i++ {
		d := startMonth.AddDate(0, 0, i)
		key := d.Format("2006-01-02")
		if !busy[key] {
			off = append(off, key)
		}
	}
	c.JSON(http.StatusOK, gin.H{"user_id": u, "month": monthStr, "off_dates": off})
}
