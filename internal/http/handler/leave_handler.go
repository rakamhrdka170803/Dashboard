package handler

import (
	"net/http"
	"strconv"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type LeaveHandler struct{ svc *service.LeaveService }

func NewLeaveHandler(s *service.LeaveService) *LeaveHandler { return &LeaveHandler{svc: s} }

type createLeaveReq struct {
	Type      domain.LeaveType `json:"type" binding:"required"`
	StartDate string           `json:"start_date" binding:"required"` // "YYYY-MM-DD"
	EndDate   string           `json:"end_date" binding:"required"`
	Reason    string           `json:"reason"`
}

func (h *LeaveHandler) Create(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	requester := uint(idf)

	var req createLeaveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sd, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad start_date"})
		return
	}
	ed, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad end_date"})
		return
	}

	m, err := h.svc.Create(service.CreateLeaveInput{RequesterID: requester, Type: req.Type, StartDate: sd, EndDate: ed, Reason: req.Reason})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": m.ID, "status": m.Status, "start_date": m.StartDate, "end_date": m.EndDate})
}

func (h *LeaveHandler) Approve(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	approver := uint(idf)
	id, _ := strconv.Atoi(c.Param("id"))
	m, err := h.svc.Approve(uint(id), approver)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status})
}
func (h *LeaveHandler) Reject(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	approver := uint(idf)
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	m, err := h.svc.Reject(uint(id), approver, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status})
}
