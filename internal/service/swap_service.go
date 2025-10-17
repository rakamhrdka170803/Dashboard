package service

import (
	"errors"
	"fmt"
	"log"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
)

type SwapService struct {
	repo  repository.SwapRepository
	sched *ScheduleService
	notif *NotificationService
	users repository.UserRepository
}

func NewSwapService(
	repo repository.SwapRepository,
	sched *ScheduleService,
	notif *NotificationService,
	users repository.UserRepository,
) *SwapService {
	return &SwapService{repo: repo, sched: sched, notif: notif, users: users}
}

// helper: ambil nama user (fallback "Agent #<id>")
func (s *SwapService) getName(uid uint) string {
	if uid == 0 || s.users == nil {
		return fmt.Sprintf("Agent #%d", uid)
	}
	u, err := s.users.FindByID(uid)
	if err != nil || u == nil || u.FullName == "" {
		return fmt.Sprintf("Agent #%d", uid)
	}
	return u.FullName
}

// Buat swap dari RFC3339 start_at (end_at default +8 jam)
func (s *SwapService) CreateFromRFC3339(requester uint, startRFC3339 string, reason string) (*domain.SwapRequest, error) {
	if requester == 0 {
		return nil, errors.New("invalid requester")
	}
	start, err := time.Parse(time.RFC3339, startRFC3339)
	if err != nil {
		return nil, errors.New("start_at invalid RFC3339")
	}
	end := start.Add(8 * time.Hour)

	// opsional: cek requester memang punya jadwal di window tsb
	if ok, err := s.sched.ExistsOverlap(requester, start, end, nil); err != nil {
		return nil, err
	} else if !ok {
		log.Printf("[swap-create] WARN requester uid=%d tidak punya jadwal overlap %s~%s (tetap diizinkan)", requester, start, end)
	}

	m := &domain.SwapRequest{
		RequesterID: requester,
		StartAt:     start,
		EndAt:       end,
		Reason:      reason,
		Status:      domain.SwapPending,
	}
	if err := s.repo.Create(m); err != nil {
		return nil, err
	}
	log.Printf("[swap-create] ok swapID=%d uid=%d start=%s end=%s",
		m.ID, requester, m.StartAt.Format(time.RFC3339), m.EndAt.Format(time.RFC3339))

	// === NOTIF: BROADCAST ke semua user (Permintaan Tukar Dinas/Libur) ===
	if s.notif == nil {
		log.Printf("[swap-create] WARN notif service is nil; skip notif swapID=%d", m.ID)
		return m, nil
	}
	refID := m.ID
	reqName := s.getName(requester)
	title := "Permintaan Tukar Dinas/Libur"

	// format body yang netral (tanpa bergantung channel/jadwal orang lain)
	body := fmt.Sprintf(
		"Nama: %s\nTanggal: %s\nJam: %s–%s",
		reqName,
		start.Format("02 Jan 2006"),
		start.Format("15:04"),
		end.Format("15:04"),
	)
	if reason != "" {
		body += fmt.Sprintf("\nAlasan: %s", reason)
	}

	ids, err := s.users.ListAllIDs()
	if err != nil {
		log.Printf("[swap-create] WARN list all user ids err=%v; fallback notify requester only", err)
		_ = s.notif.Notify(requester, title, body, "SWAP", &refID)
		return m, nil
	}
	for _, uid := range ids {
		if err := s.notif.Notify(uid, title, body, "SWAP", &refID); err != nil {
			log.Printf("[swap-create] ERROR broadcast PENDING swapID=%d to uid=%d err=%v", m.ID, uid, err)
		}
	}
	log.Printf("[swap-create] broadcast PENDING OK swapID=%d to %d users", m.ID, len(ids))

	return m, nil
}

type acceptParams struct {
	reqScheduleID uint
	cpScheduleID  uint
	reqUID        uint
	cpUID         uint
	start         time.Time
	end           time.Time
}

// Agent penerima menyetujui, pilih schedule miliknya untuk ditukar
func (s *SwapService) Accept(id uint, me uint, counterpartyScheduleID uint) (*domain.SwapRequest, error) {
	if me == 0 || counterpartyScheduleID == 0 {
		return nil, errors.New("invalid parameters")
	}

	sw, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if sw.Status != domain.SwapPending {
		return nil, errors.New("swap bukan PENDING")
	}

	params := acceptParams{
		cpScheduleID: counterpartyScheduleID,
		reqUID:       sw.RequesterID,
		cpUID:        me,
		start:        sw.StartAt,
		end:          sw.EndAt,
	}

	// cari schedule requester (3 langkah: overlap → exact → same-day)
	reqSch, err := s.sched.FindByUserAndOverlap(params.reqUID, params.start, params.end)
	if err != nil {
		if reqSch, err = s.sched.FindByUserAndWindow(params.reqUID, params.start, params.end); err != nil {
			dayStart := time.Date(params.start.Year(), params.start.Month(), params.start.Day(), 0, 0, 0, 0, params.start.Location())
			dayEnd := dayStart.Add(24 * time.Hour)
			if reqSch, err = s.sched.FindByUserAndSameDay(params.reqUID, dayStart, dayEnd); err != nil {
				return nil, errors.New("jadwal requester tidak ditemukan untuk window ini")
			}
		}
	}
	params.reqScheduleID = reqSch.ID

	// swap jadwal
	if err := s.sched.SwapSchedules(params.reqScheduleID, params.cpScheduleID, params.reqUID, params.cpUID); err != nil {
		return nil, err
	}

	now := time.Now()
	sw.Status = domain.SwapApproved
	sw.CounterpartyID = &params.cpUID
	sw.ApprovedAt = &now

	if err := s.repo.Update(sw); err != nil {
		return nil, err
	}
	log.Printf("[swap-accept] ok swapID=%d by uid=%d status=%s", sw.ID, me, sw.Status)

	// === NOTIF: BROADCAST ke semua user (Swap Disetujui) ===
	if s.notif == nil {
		log.Printf("[swap-accept] WARN notif service is nil; skip notif APPROVED swapID=%d", sw.ID)
		return sw, nil
	}
	refID := sw.ID
	reqName := s.getName(params.reqUID)
	cpName := s.getName(params.cpUID)
	title := "Swap Disetujui"

	body := fmt.Sprintf(
		"Swap #%d telah disetujui & jadwal diupdate (Requester %s • Penerima %s)",
		sw.ID, reqName, cpName,
	)

	ids, err := s.users.ListAllIDs()
	if err != nil {
		log.Printf("[swap-accept] WARN list all user ids err=%v; fallback notify requester & counterparty", err)
		_ = s.notif.Notify(params.reqUID, title, body, "SWAP", &refID)
		_ = s.notif.Notify(params.cpUID, title, body, "SWAP", &refID)
		return sw, nil
	}
	for _, uid := range ids {
		if err := s.notif.Notify(uid, title, body, "SWAP", &refID); err != nil {
			log.Printf("[swap-accept] ERROR broadcast APPROVED swapID=%d to uid=%d err=%v", sw.ID, uid, err)
		}
	}
	log.Printf("[swap-accept] broadcast APPROVED OK swapID=%d to %d users", sw.ID, len(ids))

	return sw, nil
}

func (s *SwapService) Cancel(id uint, requester uint) (*domain.SwapRequest, error) {
	sw, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if sw.RequesterID != requester {
		return nil, errors.New("bukan pengaju")
	}
	if sw.Status != domain.SwapPending {
		return nil, errors.New("hanya bisa cancel saat PENDING")
	}

	sw.Status = domain.SwapCancelled
	if err := s.repo.Update(sw); err != nil {
		return nil, err
	}
	log.Printf("[swap-cancel] ok swapID=%d by uid=%d status=%s", sw.ID, requester, sw.Status)

	// Notif pembatalan -> tetap ke requester saja (kalau mau broadcast, tinggal pluck semua ID dan kirim)
	if s.notif == nil {
		log.Printf("[swap-cancel] WARN notif service is nil; skip notif CANCEL swapID=%d", sw.ID)
		return sw, nil
	}
	refID := sw.ID
	body := fmt.Sprintf("Swap #%d dibatalkan • Window %s–%s",
		sw.ID,
		sw.StartAt.Format("02 Jan 06 15:04"),
		sw.EndAt.Format("02 Jan 06 15:04"),
	)
	if err := s.notif.Notify(requester, "Swap Dibatalkan", body, "SWAP", &refID); err != nil {
		log.Printf("[swap-cancel] ERROR notify swapID=%d uid=%d err=%v", sw.ID, requester, err)
	} else {
		log.Printf("[swap-cancel] notif CANCEL OK swapID=%d uid=%d", sw.ID, requester)
	}

	return sw, nil
}

func (s *SwapService) ListAll(page, size int) ([]domain.SwapRequest, int64, error) {
	return s.repo.ListAll(page, size)
}
