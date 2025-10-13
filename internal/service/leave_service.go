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
}

func NewLeaveService(leaves repository.LeaveRepository, users repository.UserRepository, notif *NotificationService, find *FindingService) *LeaveService {
	return &LeaveService{leaves: leaves, users: users, notif: notif, find: find}
}

type CreateLeaveInput struct {
	RequesterID uint
	Type        domain.LeaveType
	StartDate   time.Time // tanggal (00:00)
	EndDate     time.Time // tanggal (00:00), inclusive
	Reason      string
}

func (s *LeaveService) Create(in CreateLeaveInput) (*domain.LeaveRequest, error) {
	if in.RequesterID == 0 || in.Type == "" {
		return nil, errors.New("invalid input")
	}
	if in.EndDate.Before(in.StartDate) {
		return nil, errors.New("end before start")
	}

	// Rule: CUTI diblokir jika temuan bulan berjalan >= 5
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
		Status:      domain.LeavePending,
	}
	if err := s.leaves.Create(m); err != nil {
		return nil, err
	}

	// Notifikasi ke semua backoffice (SPV,TL,QC,HR,SUPER_ADMIN)
	// sederhana: ambil list users lalu filter roles; (atau buat query khusus di repo user)
	users, _, _ := s.users.List(1, 1000)
	for _, u := range users {
		isBackoffice := false
		for _, r := range u.Roles {
			switch r.Name {
			case domain.RoleSPV, domain.RoleTL, domain.RoleQC, domain.RoleHRAdmin, domain.RoleSuperAdmin:
				isBackoffice = true
			}
		}
		if isBackoffice {
			_ = s.notif.Notify(u.ID, "Pengajuan Cuti Baru", fmt.Sprintf("User #%d mengajukan cuti %s - %s", m.RequesterID, m.StartDate.Format("2006-01-02"), m.EndDate.Format("2006-01-02")), "LEAVE", &m.ID)
		}
	}
	return m, nil
}

func (s *LeaveService) Approve(id uint, approverID uint) (*domain.LeaveRequest, error) {
	m, err := s.leaves.FindByID(id)
	if err != nil {
		return nil, err
	}
	if m.Status != domain.LeavePending {
		return nil, errors.New("status not pending")
	}
	now := time.Now()
	m.Status = domain.LeaveApproved
	m.ReviewedBy = &approverID
	m.ReviewedAt = &now
	if err := s.leaves.Update(m); err != nil {
		return nil, err
	}
	_ = s.notif.Notify(m.RequesterID, "Cuti Disetujui", fmt.Sprintf("Pengajuan cuti #%d disetujui", m.ID), "LEAVE", &m.ID)
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
	m.Reason = reason + " (REJECTED)"
	if err := s.leaves.Update(m); err != nil {
		return nil, err
	}
	_ = s.notif.Notify(m.RequesterID, "Cuti Ditolak", fmt.Sprintf("Pengajuan cuti #%d ditolak: %s", m.ID, reason), "LEAVE", &m.ID)
	return m, nil
}

func (s *LeaveService) List(requesterID *uint, status *domain.LeaveStatus, from, to *time.Time, page, size int) ([]domain.LeaveRequest, int64, error) {
	return s.leaves.List(requesterID, status, from, to, page, size)
}
