package domain

import "time"

type WorkChannel string

const (
	ChannelVoice  WorkChannel = "VOICE"
	ChannelSosmed WorkChannel = "SOSMED"
)

type Schedule struct {
	ID        uint        `gorm:"primaryKey"`
	UserID    uint        `gorm:"index;not null"`
	StartAt   time.Time   `gorm:"not null"`
	EndAt     time.Time   `gorm:"not null"`
	Channel   WorkChannel `gorm:"type:VARCHAR(10);not null"` // 👈 VOICE/SOSMED
	ShiftName *string     `gorm:"size:50"`
	Notes     *string     `gorm:"size:255"`
	CreatedAt time.Time
	UpdatedAt time.Time
}
