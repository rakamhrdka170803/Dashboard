package handler

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type SwapHandler struct {
	svc     *service.SwapService
	sched   *service.ScheduleService
	userSvc *service.UserService // ← NEW
}

func NewSwapHandler(s *service.SwapService, sched *service.ScheduleService, users *service.UserService) *SwapHandler {
	return &SwapHandler{svc: s, sched: sched, userSvc: users}
}

type createSwapReq struct {
	StartAt string `json:"start_at" binding:"required"` // RFC3339
	Reason  string `json:"reason"`
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

	m, e := h.svc.CreateFromRFC3339(requester, req.StartAt, req.Reason)
	if e != nil {
		log.Printf("[swap-create] failed uid=%d start_at=%s reason=%q err=%v", requester, req.StartAt, req.Reason, e)
		c.JSON(http.StatusBadRequest, gin.H{"error": e.Error()})
		return
	}

	log.Printf("[swap-create] ok swapID=%d uid=%d start=%s end=%s",
		m.ID, requester, m.StartAt.Format(time.RFC3339), m.EndAt.Format(time.RFC3339))

	c.JSON(http.StatusCreated, gin.H{
		"id": m.ID, "status": m.Status, "start_at": m.StartAt, "end_at": m.EndAt,
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

// cari channel utk user di window tertentu; urutan: overlap → exact → same-day
func (h *SwapHandler) resolveChannelForUser(userID uint, start, end time.Time) (string, error) {
	// 1) overlap (robust)
	if sch, err := h.sched.FindByUserAndOverlap(userID, start, end); err == nil && sch != nil {
		return string(sch.Channel), nil
	}
	// 2) exact
	if sch2, err2 := h.sched.FindByUserAndWindow(userID, start, end); err2 == nil && sch2 != nil {
		return string(sch2.Channel), nil
	}
	// 3) same-day
	dayStart := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	dayEnd := dayStart.Add(24 * time.Hour)
	if sch3, err3 := h.sched.FindByUserAndSameDay(userID, dayStart, dayEnd); err3 == nil && sch3 != nil {
		return string(sch3.Channel), nil
	}
	return "", nfErr{}
}

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

	// cache nama biar gak bolak-balik DB
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
		var ch string

		if s.RequesterID != 0 && !s.StartAt.IsZero() && !s.EndAt.IsZero() {
			// coba via requester (PENDING)
			if v, e := h.resolveChannelForUser(s.RequesterID, s.StartAt, s.EndAt); e == nil && v != "" {
				ch = v
			} else if s.CounterpartyID != nil && *s.CounterpartyID != 0 {
				// fallback via counterparty (APPROVED)
				if v2, e2 := h.resolveChannelForUser(*s.CounterpartyID, s.StartAt, s.EndAt); e2 == nil && v2 != "" {
					ch = v2
					log.Printf("[swap-list] channel resolved via counterparty swapID=%d cp_uid=%d win=%s~%s ch=%s",
						s.ID, *s.CounterpartyID, s.StartAt.Format(time.RFC3339), s.EndAt.Format(time.RFC3339), ch)
				} else {
					log.Printf("[swap-list] channel not found for req & cp swapID=%d req_uid=%d cp_uid=%v win=%s~%s",
						s.ID, s.RequesterID, s.CounterpartyID, s.StartAt.Format(time.RFC3339), s.EndAt.Format(time.RFC3339))
				}
			} else {
				log.Printf("[swap-list] channel not found for requester (no counterparty yet) swapID=%d req_uid=%d win=%s~%s",
					s.ID, s.RequesterID, s.StartAt.Format(time.RFC3339), s.EndAt.Format(time.RFC3339))
			}
		} else {
			log.Printf("[swap-list] invalid requester/window swapID=%d uid=%d start=%v end=%v",
				s.ID, s.RequesterID, s.StartAt, s.EndAt)
		}

		out = append(out, gin.H{
			"id":              s.ID,
			"requester_id":    s.RequesterID,
			"requester_name":  getName(s.RequesterID), // ← NEW
			"counterparty_id": s.CounterpartyID,
			"counterparty_name": func() string { // ← NEW
				if s.CounterpartyID == nil || *s.CounterpartyID == 0 {
					return ""
				}
				return getName(*s.CounterpartyID)
			}(),
			"start_at":   s.StartAt,
			"end_at":     s.EndAt,
			"reason":     s.Reason,
			"status":     s.Status,
			"channel":    ch,
			"created_at": s.CreatedAt,
			"updated_at": s.UpdatedAt,
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
