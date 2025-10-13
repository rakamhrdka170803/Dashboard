package handler

import (
	"net/http"
	"strconv"
	"time"

	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type LatenessHandler struct{ svc *service.LatenessService }

func NewLatenessHandler(s *service.LatenessService) *LatenessHandler { return &LatenessHandler{svc: s} }

type createLateReq struct {
	AgentID uint   `json:"agent_id" binding:"required"`
	Date    string `json:"date" binding:"required"` // "2025-10-05" (YYYY-MM-DD) atau RFC3339
	Minutes int    `json:"minutes" binding:"required"`
}

func parseDateFlexible(s string) (time.Time, error) {
	// coba YYYY-MM-DD dulu
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t, nil
	}
	// lalu RFC3339
	return time.Parse(time.RFC3339, s)
}

func (h *LatenessHandler) Create(c *gin.Context) {
	// NotedBy diambil dari token (HR/SPV/TL/SUPER_ADMIN yang login)
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	notedBy := uint(idf)

	var req createLateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := parseDateFlexible(req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format"})
		return
	}
	L, err := h.svc.Create(service.CreateLatenessInput{
		AgentID: req.AgentID, Date: d, Minutes: req.Minutes, NotedByID: notedBy,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"id": L.ID, "agent_id": L.AgentID, "date": L.Date.Format("2006-01-02"), "minutes": L.Minutes, "noted_by": L.NotedByID,
	})
}

func (h *LatenessHandler) Delete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := h.svc.Delete(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (h *LatenessHandler) List(c *gin.Context) {
	q := c.Request.URL.Query()

	var agentID *uint
	if v := q.Get("agent_id"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			u := uint(n)
			agentID = &u
		}
	}
	var fromPtr, toPtr *time.Time
	if v := q.Get("from"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			fromPtr = &t
		}
	}
	if v := q.Get("to"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			toPtr = &t
		}
	}

	// RBAC visibilitas untuk Agent: hanya boleh lihat miliknya
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	rolesAny := claims["roles"]
	isAgent := false
	switch rs := rolesAny.(type) {
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
		idf, _ := claims["sub"].(float64)
		self := uint(idf)
		if agentID != nil && *agentID != self {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if agentID == nil {
			agentID = &self
		}
	}

	// Aggregasi?
	if group := q.Get("group"); group != "" {
		rows, err := h.svc.Aggregate(agentID, fromPtr, toPtr, group)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		out := make([]gin.H, 0, len(rows))
		for _, r := range rows {
			out = append(out, gin.H{
				"period": r.Period, "total_minutes": r.Total,
			})
		}
		c.JSON(http.StatusOK, gin.H{"group": group, "items": out})
		return
	}

	// List raw
	page, size := 1, 10
	if v := q.Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			page = n
		}
	}
	if v := q.Get("size"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			size = n
		}
	}

	items, total, err := h.svc.List(service.ListLateFilter{
		AgentID: agentID, From: fromPtr, To: toPtr, Page: page, Size: size,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		out = append(out, gin.H{
			"id": it.ID, "agent_id": it.AgentID, "date": it.Date.Format("2006-01-02"), "minutes": it.Minutes, "noted_by": it.NotedByID,
		})
	}
	c.JSON(http.StatusOK, gin.H{"page": page, "size": size, "total": total, "items": out})
}
