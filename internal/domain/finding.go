package domain

import "time"

type Finding struct {
	ID          uint      `gorm:"primaryKey"`
	AgentID     uint      `gorm:"index;not null"` // user dengan role AGENT
	IssuedByID  uint      `gorm:"not null"`       // user QC yang input
	Description string    `gorm:"type:text;not null"`
	IssuedAt    time.Time `gorm:"not null;default:now()"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
