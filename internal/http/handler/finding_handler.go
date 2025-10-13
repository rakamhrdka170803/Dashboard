package handler

import (
	"net/http"
	"strconv"
	"time"

	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type FindingHandler struct{ svc *service.FindingService }

func NewFindingHandler(s *service.FindingService) *FindingHandler { return &FindingHandler{svc: s} }

type createFindingReq struct {
	AgentID     uint       `json:"agent_id" binding:"required"`
	Description string     `json:"description" binding:"required"`
	IssuedAt    *time.Time `json:"issued_at"` // optional
}

func (h *FindingHandler) Create(c *gin.Context) {
	// issuer diambil dari token (QC yang login)
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	issuerID := uint(idf)

	var req createFindingReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	f, err := h.svc.Create(service.CreateFindingInput{
		AgentID:     req.AgentID,
		IssuedByID:  issuerID,
		Description: req.Description,
		IssuedAt:    req.IssuedAt,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"id": f.ID, "agent_id": f.AgentID, "issued_by": f.IssuedByID, "description": f.Description, "issued_at": f.IssuedAt,
	})
}

func (h *FindingHandler) Delete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := h.svc.Delete(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (h *FindingHandler) List(c *gin.Context) {
	q := c.Request.URL.Query()

	var agentID *uint
	if v := q.Get("agent_id"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			u := uint(n)
			agentID = &u
		}
	}

	var monthPtr *time.Time
	if v := q.Get("month"); v != "" {
		// format: 2025-10
		if t, err := time.Parse("2006-01", v); err == nil {
			monthPtr = &t
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

	items, total, err := h.svc.ListFiltered(service.ListFindingsFilter{
		AgentID: agentID, Month: monthPtr, From: fromPtr, To: toPtr, Page: page, Size: size,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// RBAC visibilitas:
	// - Agent hanya boleh lihat miliknya sendiri → jika agent & agent_id != self → 403
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
		// jika agent_id filter diisi dan bukan dirinya → tolak
		if agentID != nil && *agentID != self {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		// jika agent_id kosong → paksa filter miliknya saja
		if agentID == nil {
			agentID = &self
			items, total, err = h.svc.ListFiltered(service.ListFindingsFilter{
				AgentID: agentID, Month: monthPtr, From: fromPtr, To: toPtr, Page: page, Size: size,
			})
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
		}
	}

	out := make([]gin.H, 0, len(items))
	for _, it := range items {
		out = append(out, gin.H{
			"id": it.ID, "agent_id": it.AgentID, "issued_by": it.IssuedByID, "description": it.Description, "issued_at": it.IssuedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"page": page, "size": size, "total": total, "items": out,
	})
}
