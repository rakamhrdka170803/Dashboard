package handler

import (
	"net/http"
	"strconv"

	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type SwapHandler struct{ svc *service.SwapService }

func NewSwapHandler(s *service.SwapService) *SwapHandler { return &SwapHandler{svc: s} }

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
	page, size := 1, 10
	if v := c.Query("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			page = n
		}
	}
	if v := c.Query("size"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			size = n
		}
	}

	items, total, err := h.svc.ListAll(page, size)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		out = append(out, gin.H{
			"id": it.ID, "requester_id": it.RequesterID,
			"start_at": it.StartAt, "end_at": it.EndAt,
			"reason": it.Reason, "status": it.Status, "counterparty_id": it.CounterpartyID,
		})
	}
	c.JSON(http.StatusOK, gin.H{"page": page, "size": size, "total": total, "items": out})
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
