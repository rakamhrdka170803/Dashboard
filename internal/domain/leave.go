package domain

import "time"

type LeaveType string

const (
	LeaveCuti LeaveType = "CUTI"
)

type LeaveStatus string

const (
	LeavePending  LeaveStatus = "PENDING"
	LeaveApproved LeaveStatus = "APPROVED"
	LeaveRejected LeaveStatus = "REJECTED"
)

type LeaveRequest struct {
	ID          uint        `gorm:"primaryKey"`
	RequesterID uint        `gorm:"index;not null"`
	Type        LeaveType   `gorm:"type:VARCHAR(12);not null"`
	StartDate   time.Time   `gorm:"type:date;not null"`
	EndDate     time.Time   `gorm:"type:date;not null"`
	Reason      string      `gorm:"type:text"`
	FileURL     *string     `gorm:"type:text"` // NEW: link file upload (pdf/doc)
	Status      LeaveStatus `gorm:"type:VARCHAR(12);index;not null;default:'PENDING'"`
	ReviewedBy  *uint
	ReviewedAt  *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
