package handler

import (
	"net/http"
	"time"

	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
)

type CWCHandler struct{ svc *service.CWCService }

func NewCWCHandler(s *service.CWCService) *CWCHandler { return &CWCHandler{svc: s} }

// GET /api/v1/cwc/categories
func (h *CWCHandler) Categories(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"categories": h.svc.CategoriesDef()})
}

type upsertDailyReq struct {
	Date      string `json:"date" binding:"required"` // yyyy-mm-dd
	Complaint []int  `json:"complaint" binding:"required"`
	Request   []int  `json:"request" binding:"required"`
	Info      []int  `json:"info" binding:"required"`
}

// POST /api/v1/cwc/daily
func (h *CWCHandler) UpsertDaily(c *gin.Context) {
	var req upsertDailyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, use YYYY-MM-DD"})
		return
	}
	if err := h.svc.UpsertDaily(service.UpsertDailyInput{
		Date: d, Complaint: req.Complaint, Request: req.Request, Info: req.Info,
	}); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// GET /api/v1/cwc?start=2025-10-01&end=2025-10-31
func (h *CWCHandler) Query(c *gin.Context) {
	startStr := c.DefaultQuery("start", time.Now().AddDate(0, 0, -6).Format("2006-01-02"))
	endStr := c.DefaultQuery("end", time.Now().Format("2006-01-02"))

	start, err1 := time.Parse("2006-01-02", startStr)
	end, err2 := time.Parse("2006-01-02", endStr)
	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date range"})
		return
	}

	out, err := h.svc.QueryRange(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, out)
}

type dailyQuery struct {
	Date string `form:"date" binding:"required"`
}

// GET /api/v1/cwc/daily?date=YYYY-MM-DD
func (h *CWCHandler) GetDaily(c *gin.Context) {
	var q dailyQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := time.Parse("2006-01-02", q.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format"})
		return
	}
	m, err := h.svc.GetDaily(d)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"date":      q.Date,
		"complaint": m[service.CatComplaint],
		"request":   m[service.CatRequest],
		"info":      m[service.CatInfo],
	})
}

// DELETE /api/v1/cwc/daily?date=YYYY-MM-DD
func (h *CWCHandler) DeleteDaily(c *gin.Context) {
	var q dailyQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := time.Parse("2006-01-02", q.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format"})
		return
	}
	if err := h.svc.DeleteDaily(d); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
