package handler

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type SwapHandler struct {
	svc     *service.SwapService
	sched   *service.ScheduleService
	userSvc *service.UserService
}

func NewSwapHandler(s *service.SwapService, sched *service.ScheduleService, users *service.UserService) *SwapHandler {
	return &SwapHandler{svc: s, sched: sched, userSvc: users}
}

type createSwapReq struct {
	StartAt      string `json:"start_at" binding:"required"` // RFC3339
	Reason       string `json:"reason"`
	TargetUserID *uint  `json:"target_user_id"`
}

func (h *SwapHandler) Create(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	requester := uint(idf)

	var req createSwapReq
	if err := c.ShouldBindJSON(&req); err != nil || req.StartAt == "" {
		log.Printf("[swap-create] bad request by uid=%d err=%v body=%+v", requester, err, req)
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_at required RFC3339"})
		return
	}

	m, e := h.svc.CreateFromRFC3339(requester, req.StartAt, req.Reason, req.TargetUserID)
	if e != nil {
		log.Printf("[swap-create] failed uid=%d start_at=%s reason=%q target=%v err=%v",
			requester, req.StartAt, req.Reason, req.TargetUserID, e)
		c.JSON(http.StatusBadRequest, gin.H{"error": e.Error()})
		return
	}

	log.Printf("[swap-create] ok swapID=%d uid=%d start=%s end=%s target=%v",
		m.ID, requester, m.StartAt.Format(time.RFC3339), m.EndAt.Format(time.RFC3339), req.TargetUserID)

	c.JSON(http.StatusCreated, gin.H{
		"id":             m.ID,
		"status":         m.Status,
		"start_at":       m.StartAt,
		"end_at":         m.EndAt,
		"target_user_id": m.TargetUserID,
	})
}

type acceptSwapReq struct {
	CounterpartyScheduleID uint `json:"counterparty_schedule_id" binding:"required"`
}

func (h *SwapHandler) Accept(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	me := uint(idf)

	id, _ := strconv.Atoi(c.Param("id"))

	var body acceptSwapReq
	if err := c.ShouldBindJSON(&body); err != nil || body.CounterpartyScheduleID == 0 {
		log.Printf("[swap-accept] bad request swapID=%d by uid=%d err=%v body=%+v", id, me, err, body)
		c.JSON(http.StatusBadRequest, gin.H{"error": "counterparty_schedule_id required"})
		return
	}

	m, err := h.svc.Accept(uint(id), me, body.CounterpartyScheduleID)
	if err != nil {
		log.Printf("[swap-accept] failed swapID=%d by uid=%d cpt_sch_id=%d err=%v",
			id, me, body.CounterpartyScheduleID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[swap-accept] ok swapID=%d by uid=%d status=%s", m.ID, me, m.Status)
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status})
}

// --- helpers ---

type nfErr struct{}

func (nfErr) Error() string { return "not found" }

// GET /swaps?page=&size=
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
		log.Printf("[swap-list] failed page=%d size=%d err=%v", page, size, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// siapa yang request & apa rolenya
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	me := uint(idf)

	rolesRaw, _ := claims["roles"].([]interface{})
	isBackoffice := false
	for _, r := range rolesRaw {
		s, _ := r.(string)
		s = strings.ToUpper(strings.TrimSpace(s))
		if s == "BACKOFFICE" || s == "ADMIN" {
			isBackoffice = true
			break
		}
	}

	// cache nama
	nameCache := map[uint]string{}
	getName := func(uid uint) string {
		if uid == 0 {
			return ""
		}
		if v, ok := nameCache[uid]; ok {
			return v
		}
		u, err := h.userSvc.GetByID(uid)
		if err != nil || u == nil {
			nameCache[uid] = ""
			return ""
		}
		nameCache[uid] = u.FullName
		return u.FullName
	}

	out := make([]gin.H, 0, len(swaps))
	for _, s := range swaps {
		// ==== VISIBILITY FILTER untuk AGENT ====
		if !isBackoffice {
			// agent biasa hanya boleh lihat:
			// - swap yang ia ajukan
			// - swap yang diarahkan langsung kepadanya
			// - swap tanpa target (broadcast)
			if s.RequesterID != me {
				if s.TargetUserID != nil && *s.TargetUserID != 0 && *s.TargetUserID != me {
					// skip: ini direct ke orang lain
					continue
				}
			}
		}

		// resolve channel (opsional, untuk tampilan)
		var ch string
		if s.RequesterID != 0 && !s.StartAt.IsZero() && !s.EndAt.IsZero() {
			if v, e := h.sched.FindByUserAndOverlap(s.RequesterID, s.StartAt, s.EndAt); e == nil && v != nil {
				ch = string(v.Channel)
			} else if s.CounterpartyID != nil && *s.CounterpartyID != 0 {
				if v2, e2 := h.sched.FindByUserAndOverlap(*s.CounterpartyID, s.StartAt, s.EndAt); e2 == nil && v2 != nil {
					ch = string(v2.Channel)
				}
			}
		}

		out = append(out, gin.H{
			"id":              s.ID,
			"requester_id":    s.RequesterID,
			"requester_name":  getName(s.RequesterID),
			"counterparty_id": s.CounterpartyID,
			"counterparty_name": func() string {
				if s.CounterpartyID == nil {
					return ""
				}
				return getName(*s.CounterpartyID)
			}(),
			"target_user_id": s.TargetUserID, // ← penting utk FE guard
			"start_at":       s.StartAt,
			"end_at":         s.EndAt,
			"reason":         s.Reason,
			"status":         s.Status,
			"channel":        ch,
			"created_at":     s.CreatedAt,
			"updated_at":     s.UpdatedAt,
		})
	}

	log.Printf("[swap-list] ok page=%d size=%d items=%d total=%d", page, size, len(out), total)
	c.JSON(http.StatusOK, gin.H{
		"page": page, "size": size, "total": total, "items": out,
	})
}

func (h *SwapHandler) Cancel(c *gin.Context) {
	val, _ := c.Get("claims")
	claims := val.(jwt.MapClaims)
	idf, _ := claims["sub"].(float64)
	requester := uint(idf)

	id, _ := strconv.Atoi(c.Param("id"))
	m, err := h.svc.Cancel(uint(id), requester)
	if err != nil {
		log.Printf("[swap-cancel] failed swapID=%d by uid=%d err=%v", id, requester, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	log.Printf("[swap-cancel] ok swapID=%d by uid=%d status=%s", m.ID, requester, m.Status)
	c.JSON(http.StatusOK, gin.H{"id": m.ID, "status": m.Status})
}
