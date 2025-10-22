package service

import (
	"errors"
	"fmt"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
)

type LeaveService struct {
	leaves repository.LeaveRepository
	users  repository.UserRepository
	notif  *NotificationService
	find   *FindingService
	sched  *ScheduleService // NEW
}

func NewLeaveService(
	leaves repository.LeaveRepository,
	users repository.UserRepository,
	notif *NotificationService,
	find *FindingService,
	sched *ScheduleService, // NEW
) *LeaveService {
	return &LeaveService{leaves: leaves, users: users, notif: notif, find: find, sched: sched}
}

type CreateLeaveInput struct {
	RequesterID uint
	Type        domain.LeaveType
	StartDate   time.Time // 00:00 lokal
	EndDate     time.Time // 00:00 lokal (inklusif)
	Reason      string
	FileURL     *string // NEW
}

func (s *LeaveService) Create(in CreateLeaveInput) (*domain.LeaveRequest, error) {
	if in.RequesterID == 0 || in.Type == "" {
		return nil, errors.New("invalid input")
	}
	if in.EndDate.Before(in.StartDate) {
		return nil, errors.New("end before start")
	}

	// Rule: blokir cuti jika temuan bulan berjalan >= 5
	if in.Type == domain.LeaveCuti {
		now := time.Now()
		count, err := s.find.CountForAgentInMonth(in.RequesterID, now)
		if err != nil {
			return nil, err
		}
		if count >= 5 {
			return nil, errors.New("cuti diblokir: temuan bulan berjalan ≥ 5")
		}
	}

	m := &domain.LeaveRequest{
		RequesterID: in.RequesterID,
		Type:        in.Type,
		StartDate:   time.Date(in.StartDate.Year(), in.StartDate.Month(), in.StartDate.Day(), 0, 0, 0, 0, time.Local),
		EndDate:     time.Date(in.EndDate.Year(), in.EndDate.Month(), in.EndDate.Day(), 0, 0, 0, 0, time.Local),
		Reason:      in.Reason,
		FileURL:     in.FileURL,
		Status:      domain.LeavePending,
	}
	if err := s.leaves.Create(m); err != nil {
		return nil, err
	}

	// Notifikasi ke semua backoffice (SPV,TL,QC,HR,SUPER_ADMIN)
	users, _, _ := s.users.List(1, 1000)
	title := "Pengajuan Cuti Baru"
	body := fmt.Sprintf("Nama: %s\nTanggal: %s s/d %s",
		s.getName(in.RequesterID),
		m.StartDate.Format("02 Jan 2006"),
		m.EndDate.Format("02 Jan 2006"),
	)
	if in.Reason != "" {
		body += "\nAlasan: " + in.Reason
	}
	for _, u := range users {
		isBackoffice := false
		for _, r := range u.Roles {
			switch r.Name {
			case domain.RoleSPV, domain.RoleTL, domain.RoleQC, domain.RoleHRAdmin, domain.RoleSuperAdmin:
				isBackoffice = true
			}
		}
		if isBackoffice {
			_ = s.notif.Notify(u.ID, title, body, "LEAVE", &m.ID)
		}
	}
	return m, nil
}

func (s *LeaveService) getName(uid uint) string {
	u, err := s.users.FindByID(uid)
	if err != nil || u == nil || u.FullName == "" {
		return fmt.Sprintf("User #%d", uid)
	}
	return u.FullName
}

func (s *LeaveService) Approve(id uint, approverID uint) (*domain.LeaveRequest, error) {
	m, err := s.leaves.FindByID(id)
	if err != nil {
		return nil, err
	}
	if m.Status != domain.LeavePending {
		return nil, errors.New("status not pending")
	}

	// Hapus jadwal requester untuk setiap tanggal dalam rentang cuti (inklusif)
	if s.sched != nil {
		start := m.StartDate.In(time.Local)
		end := m.EndDate.In(time.Local)
		// iterasi per-hari
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			// ambil jadwal bulan ini
			items, err := s.sched.ListMonthly(&m.RequesterID, d)
			if err == nil {
				for _, it := range items {
					isSameDay := it.StartAt.In(time.Local).Year() == d.Year() &&
						it.StartAt.In(time.Local).Month() == d.Month() &&
						it.StartAt.In(time.Local).Day() == d.Day()
					if isSameDay {
						_ = s.sched.Delete(it.ID) // abaikan error per item
					}
				}
			}
		}
	}

	now := time.Now()
	m.Status = domain.LeaveApproved
	m.ReviewedBy = &approverID
	m.ReviewedAt = &now
	if err := s.leaves.Update(m); err != nil {
		return nil, err
	}

	_ = s.notif.Notify(
		m.RequesterID,
		"Cuti Disetujui",
		fmt.Sprintf("Pengajuan cuti #%d disetujui (%s–%s).", m.ID, m.StartDate.Format("02 Jan 2006"), m.EndDate.Format("02 Jan 2006")),
		"LEAVE", &m.ID,
	)
	return m, nil
}

func (s *LeaveService) Reject(id uint, approverID uint, reason string) (*domain.LeaveRequest, error) {
	m, err := s.leaves.FindByID(id)
	if err != nil {
		return nil, err
	}
	if m.Status != domain.LeavePending {
		return nil, errors.New("status not pending")
	}
	now := time.Now()
	m.Status = domain.LeaveRejected
	m.ReviewedBy = &approverID
	m.ReviewedAt = &now
	m.Reason = m.Reason + fmt.Sprintf("\n(REJECTED: %s)", reason)
	if err := s.leaves.Update(m); err != nil {
		return nil, err
	}
	_ = s.notif.Notify(m.RequesterID, "Cuti Ditolak", fmt.Sprintf("Pengajuan cuti #%d ditolak: %s", m.ID, reason), "LEAVE", &m.ID)
	return m, nil
}

func (s *LeaveService) List(requesterID *uint, status *domain.LeaveStatus, from, to *time.Time, page, size int) ([]domain.LeaveRequest, int64, error) {
	return s.leaves.List(requesterID, status, from, to, page, size)
}

func (s *LeaveService) Cancel(id uint, by uint) error {
	m, err := s.leaves.FindByID(id)
	if err != nil {
		return err
	}
	if m.Status != domain.LeavePending {
		return errors.New("hanya bisa membatalkan saat status PENDING")
	}
	if m.RequesterID != by {
		return errors.New("hanya pengaju yang dapat membatalkan")
	}
	return s.leaves.Delete(id)
}
