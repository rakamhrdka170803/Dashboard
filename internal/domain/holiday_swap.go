package domain

import "time"

type HolidaySwapStatus string

const (
	HolidayPendingTarget HolidaySwapStatus = "PENDING_TARGET" // menunggu accept/reject dari target
	HolidayPendingBO     HolidaySwapStatus = "PENDING_BO"     // target sudah accept → tunggu BO
	HolidayApproved      HolidaySwapStatus = "APPROVED"
	HolidayRejected      HolidaySwapStatus = "REJECTED"
	HolidayCancelled     HolidaySwapStatus = "CANCELLED"
)

type HolidaySwap struct {
	ID                uint              `gorm:"primaryKey"`
	RequesterID       uint              `gorm:"not null;index"`
	TargetUserID      uint              `gorm:"not null;index"`
	OffDate           time.Time         `gorm:"not null;type:timestamptz"`
	Reason            string            `gorm:"type:text"`
	Status            HolidaySwapStatus `gorm:"type:varchar(20);not null;index"`
	ApprovedAt        *time.Time        `gorm:"type:timestamptz"`
	CreatedScheduleID *uint             `gorm:"index"`
	CreatedAt         time.Time         `gorm:"type:timestamptz"`
	UpdatedAt         time.Time         `gorm:"type:timestamptz"`
}
