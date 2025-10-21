package domain

import "time"

type SwapStatus string

const (
	SwapPending   SwapStatus = "PENDING"
	SwapApproved  SwapStatus = "APPROVED"
	SwapCancelled SwapStatus = "CANCELLED"
)

type SwapRequest struct {
	ID          uint       `gorm:"primaryKey"`
	RequesterID uint       `gorm:"not null"`
	StartAt     time.Time  `gorm:"not null"`
	EndAt       time.Time  `gorm:"not null"`
	Reason      string     `gorm:"size:255"`
	Status      SwapStatus `gorm:"type:VARCHAR(20);not null"`

	CounterpartyID         *uint
	ApprovedAt             *time.Time
	Channel                string `gorm:"type:VARCHAR(16);default:''"`
	RequesterScheduleID    *uint
	CounterpartyScheduleID *uint

	// ⬇⬇⬇ WAJIB ada agar GORM map ke kolom target_user_id
	TargetUserID *uint `gorm:"column:target_user_id"`

	CreatedAt time.Time
	UpdatedAt time.Time
}
