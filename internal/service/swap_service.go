package service

import (
	"errors"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
)

type SwapService struct {
	repo  repository.SwapRepository
	sched *ScheduleService
	notif *NotificationService // opsional — kamu sudah punya di main
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

	// Pastikan requester memang punya jadwal di window tsb (opsional, tapi bagus)
	if ok, err := s.sched.ExistsOverlap(requester, start, end, nil); err != nil {
		return nil, err
	} else if !ok {
		// tidak ada jadwal — tetap boleh request? Kalau mau strict, return error:
		// return nil, errors.New("anda tidak punya jadwal pada window ini")
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

	// Notif ke calon penerima? (opsional)
	// _ = s.notif.SwapRequested(...)

	return m, nil
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

	// Cari schedule milik requester pada window swap (utk di-swap dengan milik me)
	reqSch, err := s.sched.FindByUserAndOverlap(sw.RequesterID, sw.StartAt, sw.EndAt)
	if err != nil {
		// fallback exact
		if reqSch, err = s.sched.FindByUserAndWindow(sw.RequesterID, sw.StartAt, sw.EndAt); err != nil {
			// fallback same-day
			dayStart := time.Date(sw.StartAt.Year(), sw.StartAt.Month(), sw.StartAt.Day(), 0, 0, 0, 0, sw.StartAt.Location())
			dayEnd := dayStart.Add(24 * time.Hour)
			if reqSch, err = s.sched.FindByUserAndSameDay(sw.RequesterID, dayStart, dayEnd); err != nil {
				return nil, errors.New("jadwal requester tidak ditemukan untuk window ini")
			}
		}
	}

	// Lakukan swap jadwal
	if err := s.sched.SwapSchedules(reqSch.ID, counterpartyScheduleID, sw.RequesterID, me); err != nil {
		return nil, err
	}

	now := time.Now()
	sw.Status = domain.SwapApproved
	sw.CounterpartyID = &me
	sw.ApprovedAt = &now

	if err := s.repo.Update(sw); err != nil {
		return nil, err
	}

	// Notifikasi kedua pihak (opsional)
	// _ = s.notif.SwapApproved(...)

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
	// _ = s.notif.SwapCancelled(...)
	return sw, nil
}

func (s *SwapService) ListAll(page, size int) ([]domain.SwapRequest, int64, error) {
	return s.repo.ListAll(page, size)
}
