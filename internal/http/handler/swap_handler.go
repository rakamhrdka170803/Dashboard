package handler

import (
	"net/http"
	"strconv"

	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type SwapHandler struct {
	svc   *service.SwapService
	sched *service.ScheduleService
}

func NewSwapHandler(s *service.SwapService, sched *service.ScheduleService) *SwapHandler {
	return &SwapHandler{svc: s, sched: sched}
}

type createSwapReq struct {
	StartAt string `json:"start_at" binding:"required"` // RFC3339, contoh: 2025-10-07T19:00:00+07:00
	Reason  string `json:"reason"`
}

// POST /swaps  (AGENT mengajukan swap)
func (h *SwapHandler) Create(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	requester := uint(idf)

	var req createSwapReq
	if err := c.ShouldBindJSON(&req); err != nil || req.StartAt == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_at required RFC3339"})
		return
	}

	m, e := h.svc.CreateFromRFC3339(requester, req.StartAt, req.Reason)
	if e != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": e.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"id": m.ID, "status": m.Status, "start_at": m.StartAt, "end_at": m.EndAt,
	})
}

type acceptSwapReq struct {
	CounterpartyScheduleID uint `json:"counterparty_schedule_id" binding:"required"`
}

// PATCH /swaps/:id/accept  (AGENT penerima memilih jadwalnya lalu tukar)
func (h *SwapHandler) Accept(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	me := uint(idf)

	id, _ := strconv.Atoi(c.Param("id"))

	var body acceptSwapReq
	if err := c.ShouldBindJSON(&body); err != nil || body.CounterpartyScheduleID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "counterparty_schedule_id required"})
		return
	}

	m, err := h.svc.Accept(uint(id), me, body.CounterpartyScheduleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status})
}

// GET /swaps?page=&size=  (semua yang login bisa lihat daftar swap — kamu sudah enforce role di router)
func (h *SwapHandler) List(c *gin.Context) {
	pageStr := c.DefaultQuery("page", "1")
	sizeStr := c.DefaultQuery("size", "20")
	page, _ := strconv.Atoi(pageStr)
	size, _ := strconv.Atoi(sizeStr)
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 200 {
		size = 20
	}

	swaps, total, err := h.svc.ListAll(page, size)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	out := make([]gin.H, 0, len(swaps))
	for _, s := range swaps {
		// default nilai channel kosong
		var ch string
		// ambil channel dari jadwal requester di window swap (jika ketemu)
		if s.RequesterID != 0 && !s.StartAt.IsZero() && !s.EndAt.IsZero() {
			if sch, err := h.sched.FindByUserAndWindow(s.RequesterID, s.StartAt, s.EndAt); err == nil && sch != nil {
				ch = string(sch.Channel)
			}
		}

		out = append(out, gin.H{
			"id":              s.ID,
			"requester_id":    s.RequesterID,
			"counterparty_id": s.CounterpartyID,
			"start_at":        s.StartAt,
			"end_at":          s.EndAt,
			"reason":          s.Reason,
			"status":          s.Status,
			"channel":         ch, // <— tambahkan di payload
			"created_at":      s.CreatedAt,
			"updated_at":      s.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"page": page, "size": size, "total": total, "items": out,
	})
}

// PATCH /swaps/:id/cancel  (hanya pengaju yang boleh cancel saat status PENDING)
func (h *SwapHandler) Cancel(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	requester := uint(idf)

	id, _ := strconv.Atoi(c.Param("id"))
	m, err := h.svc.Cancel(uint(id), requester)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status})
}
