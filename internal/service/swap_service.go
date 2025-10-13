package service

import (
	"errors"
	"fmt"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
)

type SwapService struct {
	swaps     repository.SwapRepository
	schedules *ScheduleService
	notif     *NotificationService
	users     repository.UserRepository
}

func NewSwapService(swaps repository.SwapRepository, schedules *ScheduleService, notif *NotificationService, users repository.UserRepository) *SwapService {
	return &SwapService{swaps: swaps, schedules: schedules, notif: notif, users: users}
}

type CreateSwapInput struct {
	RequesterID uint
	StartAt     time.Time
	Reason      string
}

func (s *SwapService) CreateFromRFC3339(requester uint, startRFC3339, reason string) (*domain.SwapRequest, error) {
	st, err := time.Parse(time.RFC3339, startRFC3339)
	if err != nil {
		return nil, errors.New("invalid start_at")
	}
	return s.Create(CreateSwapInput{RequesterID: requester, StartAt: st, Reason: reason})
}

func (s *SwapService) Create(in CreateSwapInput) (*domain.SwapRequest, error) {
	if in.RequesterID == 0 {
		return nil, errors.New("requester required")
	}
	endAt := in.StartAt.Add(8 * time.Hour)
	m := &domain.SwapRequest{
		RequesterID: in.RequesterID,
		StartAt:     in.StartAt,
		EndAt:       endAt,
		Reason:      in.Reason,
		Status:      domain.SwapPending,
	}
	if err := s.swaps.Create(m); err != nil {
		return nil, err
	}

	// broadcast sederhana
	users, _, _ := s.users.List(1, 1000)
	for _, u := range users {
		if u.ID == in.RequesterID {
			continue
		}
		_ = s.notif.Notify(u.ID, "Permintaan Tukar Dinas/Libur",
			fmt.Sprintf("Agent #%d mengajukan tukar %s–%s", in.RequesterID, in.StartAt.Format(time.RFC822), endAt.Format(time.RFC822)),
			"SWAP", &m.ID)
	}
	return m, nil
}

// Accept: tukar kepemilikan 2 schedule (requester window ↔ counterparty_schedule_id)
func (s *SwapService) Accept(swapID uint, counterpartyID uint, counterpartyScheduleID uint) (*domain.SwapRequest, error) {
	m, err := s.swaps.FindByID(swapID)
	if err != nil {
		return nil, err
	}
	if m.Status != domain.SwapPending {
		return nil, errors.New("status not pending")
	}
	if m.RequesterID == counterpartyID {
		return nil, errors.New("requester cannot accept their own swap")
	}

	requesterID := m.RequesterID
	cpID := counterpartyID
	start, end := m.StartAt, m.EndAt

	// Jadwal requester pada window swap (harus ada)
	reqMonthSch, _ := s.schedules.ListMonthly(&requesterID, start)
	var reqExact *domain.Schedule
	for i := range reqMonthSch {
		if reqMonthSch[i].StartAt.Equal(start) && reqMonthSch[i].EndAt.Equal(end) {
			reqExact = &reqMonthSch[i]
			break
		}
	}
	if reqExact == nil {
		return nil, errors.New("requester tidak memiliki jadwal pada window swap")
	}

	// Jadwal yang dipilih penerima
	cpSch, err := s.schedules.FindByID(counterpartyScheduleID)
	if err != nil {
		return nil, err
	}
	if cpSch.UserID != cpID {
		return nil, errors.New("jadwal yang dipilih bukan milik penerima")
	}
	// Aturan: jika kedua window sama persis → TOLAK
	if cpSch.StartAt.Equal(start) && cpSch.EndAt.Equal(end) {
		return nil, errors.New("tidak dapat swap: kedua pihak memiliki window yang sama persis")
	}

	// Cek overlap setelah ditukar
	if ok, err := s.schedules.ExistsOverlap(requesterID, cpSch.StartAt, cpSch.EndAt, &reqExact.ID); err != nil {
		return nil, err
	} else if ok {
		return nil, errors.New("swap menyebabkan bentrok pada jadwal requester")
	}
	if ok, err := s.schedules.ExistsOverlap(cpID, reqExact.StartAt, reqExact.EndAt, &cpSch.ID); err != nil {
		return nil, err
	} else if ok {
		return nil, errors.New("swap menyebabkan bentrok pada jadwal penerima")
	}

	// Tukar pemilik
	reqExact.UserID = cpID
	cpSch.UserID = requesterID
	if err := s.schedules.UpdateSchedule(reqExact); err != nil {
		return nil, err
	}
	if err := s.schedules.UpdateSchedule(cpSch); err != nil {
		return nil, err
	}

	now := time.Now()
	m.Status = domain.SwapApproved
	m.CounterpartyID = &cpID
	m.ApprovedAt = &now
	if err := s.swaps.Update(m); err != nil {
		return nil, err
	}

	_ = s.notif.Notify(requesterID, "Swap Disetujui",
		fmt.Sprintf("Swap #%d disetujui oleh Agent #%d", m.ID, cpID), "SWAP", &m.ID)
	_ = s.notif.Notify(cpID, "Swap Disetujui",
		fmt.Sprintf("Kamu menerima swap #%d (jadwal diperbarui)", m.ID), "SWAP", &m.ID)

	users, _, _ := s.users.List(1, 1000)
	for _, u := range users {
		for _, r := range u.Roles {
			switch r.Name {
			case domain.RoleSPV, domain.RoleTL, domain.RoleQC, domain.RoleHRAdmin, domain.RoleSuperAdmin:
				_ = s.notif.Notify(u.ID, "Swap Disetujui",
					fmt.Sprintf("Swap #%d telah disetujui & jadwal diupdate", m.ID), "SWAP", &m.ID)
			}
		}
	}
	return m, nil
}

func (s *SwapService) ListAll(page, size int) ([]domain.SwapRequest, int64, error) {
	return s.swaps.ListAll(page, size)
}

func (s *SwapService) Cancel(swapID uint, requesterID uint) (*domain.SwapRequest, error) {
	m, err := s.swaps.FindByID(swapID)
	if err != nil {
		return nil, err
	}
	if m.RequesterID != requesterID {
		return nil, errors.New("forbidden")
	}
	if m.Status != domain.SwapPending {
		return nil, errors.New("cannot cancel")
	}
	m.Status = domain.SwapCancelled
	if err := s.swaps.Update(m); err != nil {
		return nil, err
	}
	return m, nil
}
