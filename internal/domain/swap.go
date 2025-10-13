package domain

import "time"

// status: pending menunggu agent lain approve; approved/cancelled
type SwapStatus string

const (
	SwapPending   SwapStatus = "PENDING"
	SwapApproved  SwapStatus = "APPROVED"
	SwapCancelled SwapStatus = "CANCELLED"
)

type SwapRequest struct {
	ID             uint       `gorm:"primaryKey"`
	RequesterID    uint       `gorm:"index;not null"` // agent yang minta tukar
	StartAt        time.Time  `gorm:"not null"`
	EndAt          time.Time  `gorm:"not null"` // default StartAt + 8h
	Reason         string     `gorm:"type:text"`
	Status         SwapStatus `gorm:"type:VARCHAR(12);index;default:'PENDING'"`
	CounterpartyID *uint
	ApprovedAt     *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
