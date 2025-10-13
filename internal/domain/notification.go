package domain

import "time"

type Notification struct {
	ID        uint   `gorm:"primaryKey"`
	UserID    uint   `gorm:"index;not null"`
	Title     string `gorm:"size:120;not null"`
	Body      string `gorm:"type:text"`
	RefType   string `gorm:"size:40"` // "LEAVE","SWAP"
	RefID     *uint
	IsRead    bool `gorm:"index;default:false"`
	CreatedAt time.Time
}
