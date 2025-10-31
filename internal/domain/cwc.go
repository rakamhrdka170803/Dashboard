package domain

import (
	"time"
)

// CWCEntry menyimpan hitungan per sub-kategori per tanggal
type CWCEntry struct {
	ID       uint      `gorm:"primaryKey"`
	Date     time.Time `gorm:"type:date;index:cwc_uniq,unique"` // hanya tanggal (tanpa jam)
	Category string    `gorm:"size:20;index:cwc_uniq,unique"`   // COMPLAINT | REQUEST | INFO
	SubKey   string    `gorm:"size:120;index:cwc_uniq,unique"`  // nama sub kategori persis
	Count    int       `gorm:"not null;default:0"`

	CreatedAt time.Time
	UpdatedAt time.Time
}
