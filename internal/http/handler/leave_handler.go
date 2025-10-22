package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type LeaveHandler struct{ svc *service.LeaveService }

func NewLeaveHandler(s *service.LeaveService) *LeaveHandler { return &LeaveHandler{svc: s} }

// POST /leave-requests (multipart/form-data)
// fields: type, start_date, end_date, reason, file
func (h *LeaveHandler) Create(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	requester := uint(idf)

	typ := c.PostForm("type")
	startStr := c.PostForm("start_date")
	endStr := c.PostForm("end_date")
	reason := c.PostForm("reason")

	if typ == "" || startStr == "" || endStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type, start_date, end_date required"})
		return
	}
	sd, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad start_date"})
		return
	}
	ed, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad end_date"})
		return
	}

	var fileURL *string
	file, err := c.FormFile("file")
	if err == nil && file != nil {
		// validate ext
		ext := strings.ToLower(filepath.Ext(file.Filename))
		ok := ext == ".pdf" || ext == ".doc" || ext == ".docx"
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "file must be pdf/doc/docx"})
			return
		}
		// ensure dir
		dir := "./uploads/leave"
		_ = os.MkdirAll(dir, 0755)
		// unique name
		fn := time.Now().Format("20060102_150405") + "_" + strconv.FormatInt(time.Now().UnixNano(), 10) + ext
		dst := filepath.Join(dir, fn)
		if err := c.SaveUploadedFile(file, dst); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
			return
		}
		// public URL (served via r.Static("/uploads", "./uploads"))
		u := "/uploads/leave/" + fn
		fileURL = &u
	}

	leaveType := domain.LeaveType(strings.ToUpper(strings.TrimSpace(typ)))
	m, err := h.svc.Create(service.CreateLeaveInput{
		RequesterID: requester,
		Type:        leaveType,
		StartDate:   sd,
		EndDate:     ed,
		Reason:      reason,
		FileURL:     fileURL,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"id": m.ID, "status": m.Status, "start_date": m.StartDate, "end_date": m.EndDate, "file_url": m.FileURL,
	})
}

// GET /leave-requests?status=&page=&size=&requester_id= (opsional)
func (h *LeaveHandler) List(c *gin.Context) {
	q := c.Request.URL.Query()

	var requesterID *uint
	if v := q.Get("requester_id"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			u := uint(n)
			requesterID = &u
		}
	}
	var statusPtr *domain.LeaveStatus
	if v := q.Get("status"); v != "" {
		s := domain.LeaveStatus(strings.ToUpper(strings.TrimSpace(v)))
		statusPtr = &s
	}
	page, size := 1, 20
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

	// RBAC: agent hanya boleh lihat miliknya
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	isAgent := false
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
		idf, _ := claims["sub"].(float64)
		self := uint(idf)
		if requesterID != nil && *requesterID != self {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if requesterID == nil {
			requesterID = &self
		}
	}

	items, total, err := h.svc.List(requesterID, statusPtr, nil, nil, page, size)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	out := make([]gin.H, 0, len(items))
	for _, m := range items {
		out = append(out, gin.H{
			"id":             m.ID,
			"requester_id":   m.RequesterID,
			"requester_name": h.svcGetName(m.RequesterID),
			"type":           m.Type,
			"start_date":     m.StartDate,
			"end_date":       m.EndDate,
			"reason":         m.Reason,
			"file_url":       m.FileURL,
			"status":         m.Status,
			"reviewed_by":    m.ReviewedBy,
			"reviewed_at":    m.ReviewedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"page": page, "size": size, "total": total, "items": out})
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
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Reason) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason required"})
		return
	}
	m, err := h.svc.Reject(uint(id), approver, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status})
}

// helper untuk ambil nama dari service
func (h *LeaveHandler) svcGetName(uid uint) string {
	// kecil-kecilan: manfaatin method privat di service
	type namer interface{ GetNameForLeave(uid uint) string }
	if nn, ok := interface{}(h.svc).(namer); ok {
		return nn.GetNameForLeave(uid)
	}
	// fallback: panggil lewat metode yang ada
	return h.svcGetNameFallback(uid)
}

// fallback — karena LeaveService sudah punya getName privat, kita mirror di sini
func (h *LeaveHandler) svcGetNameFallback(uid uint) string {
	// tidak ada akses userRepo di handler ini, jadi tampilkan generic
	return fmt.Sprintf("User #%d", uid)
}

func (h *LeaveHandler) Cancel(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	me := uint(idf)

	id, _ := strconv.Atoi(c.Param("id"))
	if err := h.svc.Cancel(uint(id), me); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "cancelled"})
}
