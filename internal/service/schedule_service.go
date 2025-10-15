package service

import (
	"errors"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"

	"gorm.io/gorm"
)

type ScheduleService struct {
	schedules repository.ScheduleRepository
}

func NewScheduleService(s repository.ScheduleRepository) *ScheduleService {
	return &ScheduleService{schedules: s}
}

type CreateScheduleInput struct {
	UserID    uint
	StartAt   time.Time
	EndAt     time.Time
	Channel   domain.WorkChannel
	ShiftName *string
	Notes     *string
}

func (s *ScheduleService) Create(in CreateScheduleInput) (*domain.Schedule, error) {
	if in.UserID == 0 || in.EndAt.Sub(in.StartAt) <= 0 {
		return nil, errors.New("invalid user or time range")
	}
	if in.Channel != domain.ChannelVoice && in.Channel != domain.ChannelSosmed {
		return nil, errors.New("channel must be VOICE or SOSMED")
	}
	if ok, err := s.schedules.ExistsOverlap(in.UserID, in.StartAt, in.EndAt, nil); err != nil {
		return nil, err
	} else if ok {
		return nil, errors.New("schedule overlaps existing slot")
	}
	m := &domain.Schedule{
		UserID:    in.UserID,
		StartAt:   in.StartAt,
		EndAt:     in.EndAt,
		Channel:   in.Channel,
		ShiftName: in.ShiftName,
		Notes:     in.Notes,
	}
	if err := s.schedules.Create(m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *ScheduleService) ListMonthly(userID *uint, month time.Time) ([]domain.Schedule, error) {
	return s.schedules.ListMonthly(userID, month)
}

func (s *ScheduleService) UpdateSchedule(sch *domain.Schedule) error {
	if sch.EndAt.Sub(sch.StartAt) <= 0 {
		return errors.New("invalid time range")
	}
	ex := &sch.ID
	ok, err := s.schedules.ExistsOverlap(sch.UserID, sch.StartAt, sch.EndAt, ex)
	if err != nil {
		return err
	}
	if ok {
		return errors.New("schedule overlaps existing slot")
	}
	return s.schedules.Update(sch)
}

func (s *ScheduleService) FindByID(id uint) (*domain.Schedule, error) {
	return s.schedules.FindByID(id)
}

func (s *ScheduleService) Delete(id uint) error { return s.schedules.Delete(id) }

func (s *ScheduleService) ExistsOverlap(userID uint, start, end time.Time, excludeID *uint) (bool, error) {
	return s.schedules.ExistsOverlap(userID, start, end, excludeID)
}

func (s *ScheduleService) FindByUserAndWindow(userID uint, start, end time.Time) (*domain.Schedule, error) {
	return s.schedules.FindByUserAndWindow(userID, start, end)
}

func (s *ScheduleService) FindByUserAndOverlap(userID uint, start, end time.Time) (*domain.Schedule, error) {
	return s.schedules.FindByUserAndOverlap(userID, start, end)
}

func (s *ScheduleService) FindByUserAndSameDay(userID uint, dayStart, dayEnd time.Time) (*domain.Schedule, error) {
	return s.schedules.FindByUserAndSameDay(userID, dayStart, dayEnd)
}

// Swap 2 schedule atomik
func (s *ScheduleService) SwapSchedules(reqSchID, cpSchID uint, requesterID, counterpartyID uint) error {
	reqSch, err := s.schedules.FindByID(reqSchID)
	if err != nil {
		return err
	}
	if reqSch.UserID != requesterID {
		return errors.New("requester schedule owner mismatch")
	}
	cpSch, err := s.schedules.FindByID(cpSchID)
	if err != nil {
		return err
	}
	if cpSch.UserID != counterpartyID {
		return errors.New("counterparty schedule owner mismatch")
	}
	if reqSch.StartAt.Equal(cpSch.StartAt) && reqSch.EndAt.Equal(cpSch.EndAt) {
		return errors.New("tidak bisa approve: kedua agent punya jadwal pada jam & hari yang sama")
	}
	if ok, err := s.schedules.ExistsOverlap(requesterID, cpSch.StartAt, cpSch.EndAt, &reqSch.ID); err != nil {
		return err
	} else if ok {
		return errors.New("swap invalid: jadwal baru requester bentrok")
	}
	if ok, err := s.schedules.ExistsOverlap(counterpartyID, reqSch.StartAt, reqSch.EndAt, &cpSch.ID); err != nil {
		return err
	} else if ok {
		return errors.New("swap invalid: jadwal baru counterparty bentrok")
	}
	return s.schedules.Tx(func(tx *gorm.DB) error {
		reqSch.UserID = counterpartyID
		if err := tx.Save(reqSch).Error; err != nil {
			return err
		}
		cpSch.UserID = requesterID
		if err := tx.Save(cpSch).Error; err != nil {
			return err
		}
		return nil
	})
}
