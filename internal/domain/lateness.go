package domain

import "time"

type Lateness struct {
	ID        uint      `gorm:"primaryKey"`
	AgentID   uint      `gorm:"index;not null"` // user dengan role AGENT
	Date      time.Time `gorm:"type:date;index;not null"`
	Minutes   int       `gorm:"not null"` // menit terlambat (≥ 0)
	NotedByID uint      `gorm:"not null"` // user HR yang input
	CreatedAt time.Time
	UpdatedAt time.Time
}
