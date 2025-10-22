package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
)

type HolidaySwapService struct {
	repo  repository.HolidaySwapRepository
	sched *ScheduleService
	notif *NotificationService
	users repository.UserRepository
}

func NewHolidaySwapService(
	repo repository.HolidaySwapRepository,
	sched *ScheduleService,
	notif *NotificationService,
	users repository.UserRepository,
) *HolidaySwapService {
	return &HolidaySwapService{repo: repo, sched: sched, notif: notif, users: users}
}

func (s *HolidaySwapService) getName(uid uint) string {
	if s.users == nil || uid == 0 {
		return fmt.Sprintf("Agent #%d", uid)
	}
	u, err := s.users.FindByID(uid)
	if err != nil || u == nil || u.FullName == "" {
		return fmt.Sprintf("Agent #%d", uid)
	}
	return u.FullName
}

// roles BO yang dianggap "backoffice"
func (s *HolidaySwapService) isBO(name string) bool {
	allowed := map[string]bool{
		"SUPER_ADMIN": true,
		"HR_ADMIN":    true,
		"TL":          true,
		"SPV":         true,
		"QC":          true,
		// opsional bila ada:
		"BACKOFFICE": true,
		"ADMIN":      true,
	}
	return allowed[strings.ToUpper(strings.TrimSpace(name))]
}

func (s *HolidaySwapService) getBackofficeIDs() []uint {
	out := []uint{}
	if s.users == nil {
		return out
	}
	users, _, err := s.users.List(1, 2000)
	if err != nil {
		return out
	}
	for _, u := range users {
		for _, r := range u.Roles {
			if s.isBO(string(r.Name)) {
				out = append(out, u.ID)
				break
			}
		}
	}
	return out
}

// helper: apakah dua waktu berada pada tanggal lokal yang sama
func sameLocalDay(a, b time.Time) bool {
	al := a.In(time.Local)
	bl := b.In(time.Local)
	return al.Year() == bl.Year() && al.Month() == bl.Month() && al.Day() == bl.Day()
}

// Create request: requester ambil OFF-nya target di tanggal offDate (format: YYYY-MM-DD, local)
func (s *HolidaySwapService) Create(requester, target uint, offDate time.Time, reason string) (*domain.HolidaySwap, error) {
	if requester == 0 || target == 0 || requester == target {
		return nil, errors.New("invalid requester/target")
	}
	dayStart := time.Date(offDate.Year(), offDate.Month(), offDate.Day(), 0, 0, 0, 0, offDate.Location())
	dayEnd := dayStart.Add(24 * time.Hour)

	// target harus OFF di hari tsb
	if ok, err := s.sched.ExistsOverlap(target, dayStart, dayEnd, nil); err != nil {
		return nil, err
	} else if ok {
		return nil, errors.New("target tidak OFF pada tanggal tersebut")
	}

	m := &domain.HolidaySwap{
		RequesterID:  requester,
		TargetUserID: target,
		OffDate:      dayStart,
		Reason:       reason,
		Status:       domain.HolidayPendingTarget,
	}
	if err := s.repo.Create(m); err != nil {
		return nil, err
	}

	// Notif: A, B, BO
	if s.notif != nil {
		ref := m.ID
		title := "Permintaan Tukar Libur"
		body := fmt.Sprintf("%s meminta mengambil libur %s pada %s",
			s.getName(requester), s.getName(target), dayStart.Format("02 Jan 2006"))
		_ = s.notif.Notify(requester, title, body, "HOLIDAY_SWAP", &ref)
		_ = s.notif.Notify(target, title, body, "HOLIDAY_SWAP", &ref)
		for _, bid := range s.getBackofficeIDs() {
			if bid != requester && bid != target {
				_ = s.notif.Notify(bid, title, body, "HOLIDAY_SWAP", &ref)
			}
		}
	}
	return m, nil
}

func (s *HolidaySwapService) TargetAccept(id uint, me uint) (*domain.HolidaySwap, error) {
	m, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if m.Status != domain.HolidayPendingTarget || m.TargetUserID != me {
		return nil, errors.New("tidak berhak atau status bukan PENDING_TARGET")
	}
	m.Status = domain.HolidayPendingBO
	if err := s.repo.Update(m); err != nil {
		return nil, err
	}

	if s.notif != nil {
		ref := m.ID
		title := "Tukar Libur • Disetujui Target"
		body := fmt.Sprintf("Target %s menyetujui permintaan tukar libur pada %s. Menunggu persetujuan Backoffice.",
			s.getName(me), m.OffDate.Format("02 Jan 2006"))
		_ = s.notif.Notify(m.RequesterID, title, body, "HOLIDAY_SWAP", &ref)
		_ = s.notif.Notify(m.TargetUserID, title, body, "HOLIDAY_SWAP", &ref)
		for _, bid := range s.getBackofficeIDs() {
			_ = s.notif.Notify(bid, title, body, "HOLIDAY_SWAP", &ref)
		}
	}
	return m, nil
}

func (s *HolidaySwapService) TargetReject(id uint, me uint) (*domain.HolidaySwap, error) {
	m, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if m.Status != domain.HolidayPendingTarget || m.TargetUserID != me {
		return nil, errors.New("tidak berhak atau status bukan PENDING_TARGET")
	}
	m.Status = domain.HolidayRejected
	if err := s.repo.Update(m); err != nil {
		return nil, err
	}

	if s.notif != nil {
		ref := m.ID
		title := "Tukar Libur • Ditolak Target"
		body := fmt.Sprintf("Permintaan tukar libur pada %s ditolak oleh %s.",
			m.OffDate.Format("02 Jan 2006"), s.getName(me))
		_ = s.notif.Notify(m.RequesterID, title, body, "HOLIDAY_SWAP", &ref)
		_ = s.notif.Notify(m.TargetUserID, title, body, "HOLIDAY_SWAP", &ref)
		for _, bid := range s.getBackofficeIDs() {
			_ = s.notif.Notify(bid, title, body, "HOLIDAY_SWAP", &ref)
		}
	}
	return m, nil
}

type BOApproveInput struct {
	StartAt   time.Time
	EndAt     time.Time
	Channel   domain.WorkChannel
	ShiftName *string
	Notes     *string
}

// Versi sederhana: input hanya jam (HH:mm), end = start + 8 jam
type BOApproveSimpleInput struct {
	StartTime string             // "HH:mm"
	Channel   domain.WorkChannel // "VOICE"|"SOSMED"
	ShiftName *string
	Notes     *string
}

func (s *HolidaySwapService) BOApprove(id uint, approver uint, in BOApproveInput) (*domain.HolidaySwap, error) {
	m, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if m.Status != domain.HolidayPendingBO {
		return nil, errors.New("status bukan PENDING_BO")
	}
	if in.StartAt.Before(m.OffDate) || in.StartAt.After(m.OffDate.Add(24*time.Hour)) {
		return nil, errors.New("start_at tidak sesuai tanggal OFF")
	}
	if ok, err := s.sched.ExistsOverlap(m.TargetUserID, in.StartAt, in.EndAt, nil); err != nil {
		return nil, err
	} else if ok {
		return nil, errors.New("target sudah memiliki jadwal/overlap di jam itu")
	}

	// 1) Buat jadwal untuk TARGET
	created, err := s.sched.Create(CreateScheduleInput{
		UserID: m.TargetUserID, StartAt: in.StartAt, EndAt: in.EndAt,
		Channel: in.Channel, ShiftName: in.ShiftName, Notes: in.Notes,
	})
	if err != nil {
		return nil, err
	}

	// 2) Hapus jadwal milik REQUESTER pada tanggal tersebut (requester jadi OFF)
	reqItems, err2 := s.sched.ListMonthly(&m.RequesterID, m.OffDate)
	if err2 == nil {
		for _, it := range reqItems {
			if sameLocalDay(it.StartAt, m.OffDate) {
				_ = s.sched.Delete(it.ID) // abaikan error per item
			}
		}
	}

	// 3) Update status
	now := time.Now()
	m.Status = domain.HolidayApproved
	m.ApprovedAt = &now
	if created != nil {
		m.CreatedScheduleID = &created.ID
	}
	if err := s.repo.Update(m); err != nil {
		return nil, err
	}

	// 4) Notifikasi
	if s.notif != nil {
		ref := m.ID
		title := "Tukar Libur • Disetujui Backoffice"
		body := fmt.Sprintf(
			"Backoffice menyetujui permintaan tukar libur %s. Jadwal untuk %s telah dibuat (%s–%s, %s). Jadwal milik %s pada tanggal tersebut telah dihapus.",
			m.OffDate.Format("02 Jan 2006"),
			s.getName(m.TargetUserID),
			in.StartAt.Format("02 Jan 06 15:04"),
			in.EndAt.Format("15:04"),
			in.Channel,
			s.getName(m.RequesterID),
		)
		_ = s.notif.Notify(m.RequesterID, title, body, "HOLIDAY_SWAP", &ref)
		_ = s.notif.Notify(m.TargetUserID, title, body, "HOLIDAY_SWAP", &ref)
		for _, bid := range s.getBackofficeIDs() {
			_ = s.notif.Notify(bid, title, body, "HOLIDAY_SWAP", &ref)
		}
	}
	return m, nil
}

func (s *HolidaySwapService) BOApproveSimple(id uint, approver uint, in BOApproveSimpleInput) (*domain.HolidaySwap, error) {
	m, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if m.Status != domain.HolidayPendingBO {
		return nil, errors.New("status bukan PENDING_BO")
	}

	// parse "HH:mm"
	t, err := time.Parse("15:04", in.StartTime)
	if err != nil {
		return nil, errors.New("start_time invalid (HH:mm)")
	}
	loc := time.Local
	day := m.OffDate.In(loc)
	startAt := time.Date(day.Year(), day.Month(), day.Day(), t.Hour(), t.Minute(), 0, 0, loc)
	endAt := startAt.Add(8 * time.Hour)

	if startAt.Before(m.OffDate.In(loc)) || startAt.After(m.OffDate.In(loc).Add(24*time.Hour)) {
		return nil, errors.New("start_time tidak sesuai tanggal OFF")
	}
	if ok, err := s.sched.ExistsOverlap(m.TargetUserID, startAt, endAt, nil); err != nil {
		return nil, err
	} else if ok {
		return nil, errors.New("target sudah memiliki jadwal/overlap di jam itu")
	}

	// 1) Buat jadwal untuk TARGET
	created, err := s.sched.Create(CreateScheduleInput{
		UserID: m.TargetUserID, StartAt: startAt, EndAt: endAt,
		Channel: in.Channel, ShiftName: in.ShiftName, Notes: in.Notes,
	})
	if err != nil {
		return nil, err
	}

	// 2) Hapus jadwal milik REQUESTER pada tanggal tersebut (requester jadi OFF)
	reqItems, err2 := s.sched.ListMonthly(&m.RequesterID, m.OffDate)
	if err2 == nil {
		for _, it := range reqItems {
			if sameLocalDay(it.StartAt, m.OffDate) {
				_ = s.sched.Delete(it.ID)
			}
		}
	}

	// 3) Update status
	now := time.Now()
	m.Status = domain.HolidayApproved
	m.ApprovedAt = &now
	if created != nil {
		m.CreatedScheduleID = &created.ID
	}
	if err := s.repo.Update(m); err != nil {
		return nil, err
	}

	// 4) Notifikasi
	if s.notif != nil {
		ref := m.ID
		title := "Tukar Libur • Disetujui Backoffice"
		body := fmt.Sprintf(
			"Backoffice menyetujui permintaan tukar libur %s. Jadwal untuk %s telah dibuat (%s–%s, %s). Jadwal milik %s pada tanggal tersebut telah dihapus.",
			m.OffDate.Format("02 Jan 2006"),
			s.getName(m.TargetUserID),
			startAt.Format("02 Jan 06 15:04"),
			endAt.Format("15:04"),
			in.Channel,
			s.getName(m.RequesterID),
		)
		_ = s.notif.Notify(m.RequesterID, title, body, "HOLIDAY_SWAP", &ref)
		_ = s.notif.Notify(m.TargetUserID, title, body, "HOLIDAY_SWAP", &ref)
		for _, bid := range s.getBackofficeIDs() {
			_ = s.notif.Notify(bid, title, body, "HOLIDAY_SWAP", &ref)
		}
	}
	return m, nil
}

func (s *HolidaySwapService) Cancel(id uint, by uint) (*domain.HolidaySwap, error) {
	m, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if m.RequesterID != by {
		return nil, errors.New("hanya pengaju yang dapat membatalkan")
	}
	if m.Status != domain.HolidayPendingTarget && m.Status != domain.HolidayPendingBO {
		return nil, errors.New("hanya bisa cancel saat menunggu persetujuan")
	}
	m.Status = domain.HolidayCancelled
	if err := s.repo.Update(m); err != nil {
		return nil, err
	}
	if s.notif != nil {
		ref := m.ID
		_ = s.notif.Notify(m.RequesterID, "Tukar Libur • Dibatalkan", "Permintaan dibatalkan oleh pengaju.", "HOLIDAY_SWAP", &ref)
		_ = s.notif.Notify(m.TargetUserID, "Tukar Libur • Dibatalkan", "Permintaan dibatalkan oleh pengaju.", "HOLIDAY_SWAP", &ref)
	}
	return m, nil
}

func (s *HolidaySwapService) List(page, size int) ([]domain.HolidaySwap, int64, error) {
	return s.repo.List(page, size)
}
